/**
 * Displays the restore dialog.
 */
var ADOBE = ADOBE || {};

ADOBE.LoginDialog = Backbone.View.extend({
	tagName:  "div",
	
	className: "modal-background",
	
	initialize: function() {
		var html  = "<form id='login'>";
		    html +=    "<div class='title'>Login</div>";
		    html +=    "<div class='description'>Please sign into your account.</div>";
		    html +=    "<div><input id='username' type='text' name='username' placeholder='Username'/><span class='required'>*</span></div>";
		    html +=    "<div><input id='password' type='password' name='password' placeholder='Password'/><span class='required'>*</span></div>";
		    html +=    "<span class='links'><a href='#'>Forgot password?</a> Print Subscriber? <a href='#'>Register</a></span>"
		    html +=    "<div class='row'>";
		    html +=        "<div class='form-button form-button-dark'>Cancel</div>";
		    html +=        "<div class='form-button form-button-light'>Submit</div>";
		    html +=    "</div>";
		    html +=    "<div class='error'></div>";
			html += "</form>";
			
		this.template = _.template(html);
	},
	
	render: function() {
		this.$el.html(this.template());
		
		var scope = this;
		this.$el.find(".form-button-dark").on("click", function() { scope.close() });
		this.$el.find(".form-button-light").on("click", function() { scope.submit_clickHandler() });
		
		return this;
	},
	
	submit_clickHandler: function() {
		var $username = this.$el.find("#username");
		var $password = this.$el.find("#password");
		$username.css("border-color", "rgb(159,159,159)");
		$password.css("border-color", "rgb(159,159,159)");
		
		// Make sure username and password are not blank.
		if ($username.val() == "" || $("#password").val() == "") {
			if ($username.val() == "")
				$username.css("border-color", "rgb(255,0,0)"); // Show an error state.
			
			if ($password.val() == "")
				$password.css("border-color", "rgb(255,0,0)"); // Show an error state.
		} else {
			// Login using the authenticationService.
			var transaction = adobeDPS.authenticationService.login($username.val(), $password.val());
			transaction.completedSignal.addOnce(function(transaction) {
				var transactionStates = adobeDPS.transactionManager.transactionStates;
				if (transaction.state == transactionStates.FAILED) {
					$("#login .error").html("Authentication Failed.")
				} else if (transaction.state == transactionStates.FINISHED){
					this.$el.trigger("loginSuccess");
					this.close();
				}
			}, this);
		}
	},
	
	open: function() {
		this.$el.find("#login").addClass("pop");
	},
	
	close: function() {
		this.$el.remove();
	},
	
	// Handler for when a user chooses to restore purchases.
	restore_clickHandler: function() {
		adobeDPS.receiptService.restorePurchases();
		this.close();
	}
});
