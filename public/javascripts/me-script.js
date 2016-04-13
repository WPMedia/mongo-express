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
  }); //end document.ready

