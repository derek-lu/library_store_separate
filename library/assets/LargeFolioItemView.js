/**
 * Displays a folio in the one up view.
 */
var ADOBE = ADOBE || {};

ADOBE.LargeFolioItemView = Backbone.View.extend({
	tagName:  "div",
	
	className: "large-folio-item-view",
	
	template: _.template("<img id='folio-image' width='600' height='800' onmousedown='return false'/><div class='off-fade'></div><div class='magazine-title'><%= title %></div>"),
	
	updateDialog: null,
	
	isTrackingTransaction: false,
	
	// A reference to the current downloadTransaction. Used to pause and resume a download.
	currentDownloadTransaction: null,
	
	// A reference to the original folio since the collection uses a cloned copy.
	folio: null,
	
	render: function() {
		if (this.model) {
			// Since these renderers are recycled, make sure to remove listeners.
			if (this.folio)
				this.folio.updatedSignal.remove(this.updatedSignalHandler, this);
			
			var json = this.model.toJSON();
			this.$el.html(this.template(json));
			
			if (ADOBE.isAPIAvailable) {
				// Get a reference to the original folio object.
				this.folio = adobeDPS.libraryService.folioMap.internal[this.model.attributes.id];

				// Load the preview image.
				var transaction = this.folio.getPreviewImage(600, 800, true);
				transaction.completedSignal.addOnce(function(transaction) {
					if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
						this.$el.find("#folio-image").attr("src", transaction.previewImageURL);
					}
				}, this);
	
				var scope = this;
				this.$el.on("click", ".off-fade", function() { scope.folioThumb_clickHandler() });
				this.$el.on("click", "#download-toggle", function() { scope.downloadToggleButton_clickHandler() });
				
				// Add a handler to listen for updates.
				this.folio.updatedSignal.add(this.updatedSignalHandler, this);
	
				// Determine if the folio was in the middle of downloading.
				// If the folio is downloading then find the paused transaction and resume.
				if (this.folio.state == ADOBE.FolioStates.DOWNLOADING) {
					this.enableImage(false);
					var transactions = this.folio.currentTransactions;
					var len = transactions.length;
					for (var i = 0; i < len; i++) {
						var transaction = transactions[i];
						if (transaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
							transaction.resume();
							break;
						}
					}
				}
			} else { // Testing on the desktop.
				this.$el.find("#folio-image").attr("src", json.libraryPreviewUrl);
				this.$el.find("#buy-button").html("$1.99");
			}
		} else {
			this.$el.html("");
		}
		
		return this;
	},
	
	updatedSignalHandler: function(properties) {
		// The buy button is disabled before downloading so if it is made viewable
		// during the download then enable it again. 
		if (properties.indexOf("isViewable") > -1 && this.folio.isViewable)
			this.enableImage(true);

		if (properties.indexOf("currentTransactions") > -1 && this.folio.currentTransactions.length > 0)
			this.trackTransaction();
	},
	
	trackTransaction: function() {
		if (this.isTrackingTransaction)
			return;
	
		var transaction;
		for (var i = 0; i < this.folio.currentTransactions.length; i++) {
	        transaction = this.folio.currentTransactions[i];
	        if (transaction.isFolioStateChangingTransaction()) {
	            // found one, so break and attach to this one
	            break;
	        } else {
	            // null out transaction since we didn't find a traceable one
	            transaction = null;
	        }
	    }
	
		if (!transaction)
			return;
		
		var transactionType = transaction.jsonClassName;
		if (transactionType != "DownloadTransaction" &&
			transactionType != "UpdateTransaction" &&
			transactionType != "PurchaseTransaction" &&
			transactionType != "ArchiveTransaction" &&
			transactionType != "ViewTransaction") {
				return;
		}
			
		// Check if the transaction is active yet
		if (transaction.state == adobeDPS.transactionManager.transactionStates.INITALIZED) {
			// This transaction is not yet started, but most likely soon will
			// so setup a callback for when the transaction starts
			transaction.stateChangedSignal.addOnce(this.trackTransaction, this);
			return;
		}
		
		this.isTrackingTransaction = true;
			
		if (transactionType == "DownloadTransaction" || transactionType == "UpdateTransaction") {
			this.showDownloadStatus(true);
			transaction.stateChangedSignal.add(this.download_stateChangedSignalHandler, this);
			transaction.progressSignal.add(this.download_progressSignalHandler, this);
			transaction.completedSignal.add(this.download_completedSignalHandler, this);
			this.currentDownloadTransaction = transaction;
		} else {
			// Add a callback for the transaction.
			transaction.completedSignal.addOnce(function() {
				this.isTrackingTransaction = false;
			}, this)
		}
	},
	
	// Handler for when a user clicks the buy button.
	folioThumb_clickHandler: function() {
		var state = this.folio.state;
		if (state == ADOBE.FolioStates.INSTALLED || this.folio.isViewable) {
			if (this.folio.isUpdatable)
				this.displayUpdateDialog();
			else
				this.folio.view();
		}
	},
	
	enableImage: function(value) {
		this.$el.find("#folio-image").css("opacity", value ? 1 : .85);
	},
	
	// Displays the dialog for confirmation of whether or not to update the folio.
	displayUpdateDialog: function() {
		var desc = "An updated version of " + this.folio.title + " is available. Do you want to download this update now?";
		var html  = "<div id='update-dialog-modal-background' class='modal-background'>"; // Make the dialog modal.
			html +=     "<div id='update-dialog' class='dialog'>";
			html += 	    "<p id='description'>" + desc + "</p>";
			html += 	    "<button id='no'>No</button><button id='yes'>Yes</button>";
			html +=     "</div>";
			html += "</div>";

		this.updateDialog = $(html);
		
		this.updateDialog.appendTo("body");
		
		$("#update-dialog").addClass("pop");
		$("#update-dialog-modal-background").css("display", "inline");
		
		var scope = this;
		$("#update-dialog").on("click", "#no", function() { scope.no_updateDialogHandler() });
		$("#update-dialog").on("click", "#yes", function() { scope.yes_updateFolio() });
	},
	
	// Handler for the "Yes" button of the update dialog.
	yes_updateFolio: function() {
		this.updateDialog.remove();
		this.folio.update();
		this.showDownloadStatus(true);
		this.setDownloadPercent(0);
	},
	
	// Handler for the "No" button of the update dialog.
	no_updateDialogHandler: function() {
		this.updateDialog.remove();
		this.folio.view();
	},
	
	// Downloads are automatically paused if another one is initiated so watch for changes with this callback.
	download_stateChangedSignalHandler: function(transaction) {
		if (this.currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
			// Downloads do not resume from the last point so set the percent back to 0.
			this.setDownloadPercent(0);
			this.$el.find("#download-toggle").addClass("download-status-restart");
			this.$el.find("#download-toggle").removeClass("download-status-close");
		} else {
			this.$el.find("#download-toggle").removeClass("download-status-restart");
			this.$el.find("#download-toggle").addClass("download-status-close");
		}
	},
	
	// Updates the progress bar for downloads and updates.
	download_progressSignalHandler: function(transaction) {
		this.setDownloadPercent(transaction.progress);
	},
	
	// Handler for when a download or update completes.
	download_completedSignalHandler: function(transaction) {
		transaction.stateChangedSignal.remove(this.download_stateChangedSignalHandler, this);
		transaction.progressSignal.remove(this.download_progressSignalHandler, this);
		transaction.completedSignal.remove(this.download_completedSignalHandler, this);
		this.isTrackingTransaction = false;
		this.showDownloadStatus(false);
	},
	
	// User clicked the stop/restart button for the download.
	downloadToggleButton_clickHandler: function() {
		if (!this.currentDownloadTransaction)
			return;

		if (this.currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
			this.currentDownloadTransaction.resume();
			this.$el.find("#download-toggle").removeClass("download-status-restart");
			this.$el.find("#download-toggle").addClass("download-status-close");
		} else {
			this.currentDownloadTransaction.pause();
			this.$el.find("#download-toggle").addClass("download-status-restart");
			this.$el.find("#download-toggle").removeClass("download-status-close");
		}
	},
	
	// Displays/Hides the download/update progress bar.
	showDownloadStatus: function(value) {
		if (value) {
			if (!this.downloadStatus) {
				var html  = "<div class='download-status'>";
				    html +=    "<div class='progress-track'><div class='progress-bar-left'/><div class='progress-bar-middle'/><div class='progress-bar-right'/></div>";
				    html +=    "<div id='download-toggle' class='download-status-close'></div>";
				    html += "</div>";
				
				this.downloadStatus = $(html);
				this.downloadStatus.appendTo(this.$el);
			}
		} else {
			if (this.downloadStatus) {
				this.downloadStatus.remove();
				this.downloadStatus = null;
			}
		}
	},
	
	// Sets the download progress bar.
	setDownloadPercent: function(value) {
		value *= .01;
		var maxWidth = 152; // 152 is max width of track.
		this.$el.find(".progress-bar-middle").css("width", Math.min(Math.max(maxWidth * value, 8), maxWidth) - 8); //  subtract 4 for the left and 4 for the right
	},
	
	setState: function(value) {
		if (value == "on") {
			this.$el.find(".off-fade").css("opacity", 0);
			this.$el.find(".magazine-title").css("opacity", 1);
			this.$el.find(".download-status").css("opacity", 1);
		} else if (value == "off") {
			this.$el.find(".off-fade").css("opacity", .5);
			this.$el.find(".magazine-title").css("opacity", 0);
			this.$el.find(".download-status").css("opacity", 0);
		}
	}
});
