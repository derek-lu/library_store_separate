/**
 * Displays the restore dialog.
 */
var ADOBE = ADOBE || {};

ADOBE.RestoreDialog = Backbone.View.extend({
	tagName:  "div",
	
	className: "modal-background",
	
	initialize: function() {
		var html  = "<div id='restore-dialog' class='dialog'>";
			html +=     "<p id='description'>Do you want to restore your previous purchases?</p>";
			html += 	"<button id='noThanks'>No Thanks</button><button id='restore'>Restore</button>";
			html += "</div>";
			
		this.template = _.template(html);
	},
	
	render: function() {
		this.$el.html(this.template());
		
		var scope = this;
		this.$el.on("click", "#noThanks", function() { scope.close() });
		this.$el.on("click", "#restore", function() { scope.restore_clickHandler() });
		
		return this;
	},
	
	open: function() {
		this.$el.find("#restore-dialog").addClass("pop");
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
