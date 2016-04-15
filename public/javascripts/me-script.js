'use strict';
$(document).ready(function() {
    $('#database').popover({
        content: 'Database names must begin with a letter or underscore, and can contain only letters, numbers, underscores and dots.',
    });

    //delete db script
    $('.deleteButton').tooltip({
        title: 'Warning! Are you sure you want to delete this database? All collenctions and documents will be deleted.',
    });

    $('.deleteButton').on('click', function(event) {
        $('.deleteButton').tooltip('hide');
        event.preventDefault();
        var target = $(this);
        var parentForm = $('#' + target.attr('childof'));

        $('#confirmation-input').attr('shouldbe', target.attr('database-name'));
        $('#modal-database-name').text(target.attr('database-name'));
        $('#confirm-deletion').modal({ backdrop: 'static', keyboard: false })
            .one('shown.bs.modal', function() {
                $('#confirmation-input').focus();
            })
            .one('click', '#delete', function() {
                var input = $('#confirmation-input');
                if (input.val().toLowerCase() === input.attr('shouldbe').toLowerCase()) {
                    parentForm.trigger('submit');
                }
            });
    });

    //end delete db script

    //backup db script
    $(".panel.database").each(function(index,ele){
        var db=$(ele).attr("db-name");
        // console.log("db-name:"+db);
        //if all collections is checked, uncheck and disable all other checkboxes, or enable all others

        function checkButtonStatus($ele){
            if ($ele.find("input[type='checkbox']:checked").length>0){
                $ele.find('button.backup-button').prop("disabled",false);
            } else {
                $ele.find('button.backup-button').prop("disabled",true);
            }
        }

        $(ele).find(".select-all").on("click",function(){
            $(ele).find("input[name='"+db+"-collections']").prop('checked',true);
            checkButtonStatus($(ele))
        })
        $(ele).find(".deselect-all").on("click",function(){
            $(ele).find("input[name='"+db+"-collections']").prop('checked',false);
            checkButtonStatus($(ele));
        })


        //if all checkboxes are unchecked, disable backup button, otherwise enable it.
        $(ele).find("input[type='checkbox']").on("change",function(){
            checkButtonStatus($(ele));
        });

        //submit backup async request
        $(ele).find('button.backup-button').on("click",function(){
            var collections=$(ele).find("form input[name^="+db+"]:checked").map(function(){
                return $(this).val();
            }).get();
            console.log("collections="+collections);
            $.post( "/db/"+db+"/async/backup", { 'collections': collections },function(resp){
                console.log("backup call success!")
            } );
        })
    });

    //end backup db script

    //restore db script

    $("a.restoreTo").on("click",function(){
        if($(this).text()==="restore"){
            $(this).text("back to list");
            var filename=$(this).attr("file-name");
            // console.log("restore filename="+filename);
            $(this).parents("tbody").find("tr[file-name!='"+filename+"']").hide();
            $(".select-db-list").show();
        } else {
            $(this).text("restore");
            $(this).parents("tbody").find("tr").show();
            $(".select-db-list").hide();
        }
    })

    $(".panel.database").each(function(index,ele){
        var db=$(ele).attr("db-name");
        // console.log("db-name:"+db);
        //if all collections is checked, uncheck and disable all other checkboxes, or enable all others

        function checkButtonStatus($ele){
            var collectionNameExisted=false;
            if($(ele).find("input[type='radio']:checked").length>0&&$(ele).find("input[type='radio']:checked").val()){
                $ele.find('button.restore-button').prop("disabled",false);
            } else if ($(ele).find("input[name='newCollection']").not(":disabled").length>0){
                var val=$(ele).find("input[name='newCollection']").not(":disabled").val();
                if (val){
                    $ele.find("input[type='radio']").each(function(idx,radioBtn){
                        if ($(radioBtn).val()===val){
                            collectionNameExisted=true;
                        }
                    })
                }
                $ele.find('button.restore-button').prop("disabled",collectionNameExisted||!val);
            } else {
                $ele.find('button.restore-button').prop("disabled",true);
            }
            if (collectionNameExisted){
                $(ele).find('.name-existed').show();
            } else {
                $(ele).find('.name-existed').hide();
            }
        }

        //if all checkboxes are unchecked, disable backup button, otherwise enable it.
        $(ele).find("input[type='radio']").on("change",function(){
            //if select "create new collection, enable the input box
            if ($(this).attr("id")==="newCollection"){
                $(ele).find("input[name='newCollection']").prop("disabled",false);
            } else {
                $(ele).find("input[name='newCollection']").prop("disabled",true);
            }
            checkButtonStatus($(ele));
        });

        //event gets triggered by either keypres and mouse paste
        $(ele).find("input[name='newCollection']").on("input propertychange",function(){
            checkButtonStatus($(ele));
        });

        //submit backup async request
        $(ele).find('button.restore-button').on("click",function(){
            var data={
                dbname:$(this).attr("db-name"),
                isNewCollection:($(ele).find("input[name='newCollection']").not(":disabled").length>0)?true:undefined,
                collection:$(ele).find("input[type='radio']:checked").val()||$(ele).find("input[name='newCollection']").val(),
                filename:$("table tbody tr:visible").attr("file-name")
            }

            console.log("data="+JSON.stringify(data,true));
            // console.log("collections="+collections);
            $.post( "/db/"+db+"/async/restore", data,function(resp){
                console.log("restore call success!")
            } );
        })
    });

    //end restore db script


}); //end document.ready

