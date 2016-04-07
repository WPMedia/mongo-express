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
     $('.backup-button').tooltip({
        title: 'Warning! Are you sure you want to backup this database?',
      });

      $('.backup-button').on('click', function(event) {
        $('.backup-button').tooltip('hide');
        event.preventDefault();
        var target = $(this);
        var parentForm = $('#' + target.attr('childof'));

        $('#confirmation-input').attr('shouldbe', target.attr('database-name'));
        $('#modal-database-name').text(target.attr('database-name'));
        $('#confirm-backup').modal({ backdrop: 'static', keyboard: false })
                .one('shown.bs.modal', function() {
                  $('#confirmation-input').focus();
                })
                .one('click', '#backup', function() {
                  var input = $('#confirmation-input');
                  if (input.val().toLowerCase() === input.attr('shouldbe').toLowerCase()) {
                    // parentForm.trigger('submit');
                    console.log("backup database request sent!");
                  }
                });
      });
     //end backup db script

     
  });