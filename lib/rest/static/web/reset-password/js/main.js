$(function() {
    function showAlert(text) {
        $("#alertFormSubmit").removeClass('hidden');
        $("#alertFormSubmit").html(text);
    }
    
    function hideAlert() {
        $("#alertFormSubmit").addClass('hidden');
    }
    
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }
    
    $('#formResetPassword').submit(function(event) {
        if (!$("#inputPassword").val()) {
            showAlert('Please input new password');
        } else if ($("#inputPassword").val() != $("#inputConfirmPassword").val()) {
            showAlert('Passwords do not match');
        } else {
            hideAlert();
            
            $("#formResetPassword :input").prop("disabled", true);
            $.ajax({
                url: "/api/auth/reset-password",
                type: "POST",
                dataType : "json",
                data: {
                    token: getParameterByName('token'),
                    password: $("#inputPassword").val()
                }
            }).done(function(json) {
                window.location.href = './success.html'
            }).fail(function(xhr, status, errorThrown) {
                $("#formResetPassword :input").prop("disabled", false);
                showAlert(xhr.responseJSON.message);
            });
        }
        
        event.preventDefault();
    });
});