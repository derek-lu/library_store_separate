/**
 * Displays the subscribe dialog
 */
var ADOBE = ADOBE || {};

ADOBE.SubscribeDialog = Backbone.View.extend({
	tagName:  "div",
	
	className: "modal-background",
	
	initialize: function() {
		var html  = 	"<div id='subscribe-dialog' class='dialog'>";
			html += 		"<p id='title'>Subscribe to Local</p>";
			html += 		"<p id='description'>Select a digital subscription option below. Your digital subscription will start immediately from the latest issue after you complete the purchase process.</p>";
			html += 		this.model; // The model is the html of the buttons.
			html += 		"<button id='cancel'>Cancel</button>";
			html += 	"</div>";
			
		this.template = _.template(html);
	},
	
	render: function() {
		this.$el.html(this.template());
		
		var scope = this;
		this.$el.find("#cancel").on("click", function() { scope.close() });
		
		// The handler for the individual subscription buttons.
		this.$el.on("click", ".subscribe-button", function(e){ scope.subscribe_clickHandler(e) });
		
		return this;
	},
	
	open: function() {
		this.$el.find("#subscribe-dialog").addClass("pop");
	},
	
	close: function() {
		this.$el.remove();
	},
	
	// Handles clicks from any of the subscription buttons.
	subscribe_clickHandler: function(e) {
		if (ADOBE.isAPIAvailable) {
			// The product id is set to the id of the element so get a reference to it.
			var productId = $(e.currentTarget).attr("id");
			
			var transaction = adobeDPS.receiptService.availableSubscriptions[productId].purchase();
			transaction.completedSignal.addOnce(function(transaction) {
				if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED)
					$("body").trigger("subscriptionPurchased"); // Need to trigger from the body since this.$el is no longer in the dom.
			});
		}
		
		this.close();
	}
});
