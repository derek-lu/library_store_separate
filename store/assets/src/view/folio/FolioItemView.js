/**
 * 
 */
var ADOBE = ADOBE || {};

ADOBE.FolioItemView = Backbone.View.extend({
	tagName:  "div",
	
	className: "folio-item-view",
	
	template: _.template("<img id='folio-thumb' class='folio-thumb' width='90' height='125' /><div class='text'><div class='magazine-title'><%= title %><div class='publication-date'><%= dateLabel %></div></div><div class='purchase-state'></div><div class='black-button' id='buy-button'></div></div>"),
	
	// The dialog asking whether or not to update the folio if an update is available.
	updateDialog: null,
	
	isTrackingTransaction: false,
	
	// A reference to the current downloadTransaction. Used to pause and resume a download.
	currentDownloadTransaction: null,
	
	// A reference to the original folio since the collection uses a cloned copy.
	folio: null,
	
	isBuyButtonEnabled: true,

	months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
	
	render: function() {
		var json = this.model.toJSON();

		var publicationDate = json.publicationDate;
		json.dateLabel = this.months[publicationDate.getMonth()] + " " + publicationDate.getFullYear();

		this.$el.html(this.template(json));

		if (ADOBE.isAPIAvailable) {
			//Get a reference to the original folio object.
			this.folio = adobeDPS.libraryService.folioMap.internal[this.model.attributes.id];
			
			// Set a delay to load the preview image in case this renderer has
			// already been removed from the DOM. This will be the case when
			// multiple folios are added within the same frame from the API causing
			// some folios to be added and then removed immediately.
			setTimeout(function(){ scope.loadPreviewImage() }, 100);

			this.updateBuyButtonLabel();
			
			// Add the handlers for the buttons.
			var scope = this;
			this.$el.on("click", "#buy-button", function() { scope.buyButton_clickHandler() });
			this.$el.on("click", "#download-toggle", function() { scope.downloadToggleButton_clickHandler() });
			
			// Add a handler to listen for updates.
			this.folio.updatedSignal.add(this.updatedSignalHandler, this);

			// Determine if the folio was in the middle of downloading.
			// If the folio is downloading then find the paused transaction and resume.
			if (this.folio.state == ADOBE.FolioStates.DOWNLOADING) {
				this.enableBuyButton(false);
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
			this.$el.find(".folio-thumb").attr("src", json.libraryPreviewUrl);
			this.$el.find("#buy-button").html("$1.99");
		}
		
		return this;
	},

	loadPreviewImage: function() {
		if (this.el.parentElement) {
			var transaction = this.folio.getPreviewImage(90, 125, true);
			transaction.completedSignal.addOnce(function(transaction) {
				if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
					this.$el.find(".folio-thumb").attr("src", transaction.previewImageURL);
				}
			}, this);
		}
	},
	
	updatedSignalHandler: function(properties) {
		this.updateBuyButtonLabel();
		
		// The buy button is disabled before downloading so if it is made viewable
		// during the download then enable it again. 
		if (properties.indexOf("isViewable") > -1 && this.folio.isViewable)
			this.enableBuyButton(true);
			
		if ((properties.indexOf("state") > -1 || properties.indexOf("currentTransactions") > -1) && this.folio.currentTransactions.length > 0)
			this.trackTransaction();
	},
	
	// Updates the label of the buy button and state based on folio.state.
	updateBuyButtonLabel: function() {
		var state = "";
		var label = "";
		switch (this.folio.state) {
			case ADOBE.FolioStates.INVALID:
				state = "Invalid";
				label = "Error";
				break;
			case ADOBE.FolioStates.UNAVAILABLE:
				state = "Unavailable";
				label = "Error";
				break;
			case ADOBE.FolioStates.PURCHASABLE:
				label = this.folio.price;
				break;
			case ADOBE.FolioStates.ENTITLED:
				label = "Download";
				break;
			case ADOBE.FolioStates.INSTALLED:
			case ADOBE.FolioStates.DOWNLOADING:
			case ADOBE.FolioStates.PURCHASING:
				label = "View";
				break;
			case ADOBE.FolioStates.EXTRACTING:
			case ADOBE.FolioStates.EXTRACTABLE:
				state = "Extracting";
				label = "View";
				break;
		}
		
		this.$el.find(".state").html(state);
		this.$el.find("#buy-button").html(label);
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
		
		this.currentDownloadTransaction = null;
		if (transactionType == "DownloadTransaction" || transactionType == "UpdateTransaction") {
			this.showDownloadStatus(true);
			transaction.stateChangedSignal.add(this.download_stateChangedSignalHandler, this);
			transaction.progressSignal.add(this.download_progressSignalHandler, this);
			transaction.completedSignal.add(this.download_completedSignalHandler, this);
			this.currentDownloadTransaction = transaction;
		} else {
			var state;
			if (transactionType == "PurchaseTransaction")
				state = "Purchasing...";
			else if (transactionType == "ArchiveTransaction")
				state = "Archiving...";
			else if (transactionType == "ViewTransaction")
				state = "Loading...";
			
			this.$el.find(".state").html(state);
			
			// Add a callback for the transaction.
			transaction.completedSignal.addOnce(function() {
				this.$el.find(".state").html("");
				this.isTrackingTransaction = false;
			}, this)
		}
	},
	
	// Handler for when a user clicks the buy button.
	buyButton_clickHandler: function() {
		var state = this.folio.state;
		if (state == ADOBE.FolioStates.PURCHASABLE) {
			this.purchase();
		} else if (state == ADOBE.FolioStates.INSTALLED || this.folio.isViewable) {
			if (this.folio.isUpdatable)
				this.displayUpdateDialog();
			else
				this.folio.view();
		} else if (state == ADOBE.FolioStates.ENTITLED) {
			if (this.isBuyButtonEnabled)
				this.download();
		}
	},
	
	// Changes the opacity of the buyButton to give an enabled or disabled state.
	enableBuyButton: function(value) {
		this.$el.find("#buy-button").css("opacity", value ? 1 : .6);
		
		this.isBuyButtonEnabled = value;
	},
	
	// Downloads the folio.
	download: function() {
		this.enableBuyButton(false);
				
		this.showDownloadStatus(true);
		this.setDownloadPercent(0);
		
		this.folio.download();
	},
	
	// Purchases the folio.
	purchase: function() {
		var transaction = this.folio.purchase();
		transaction.completedSignal.addOnce(function(transaction) {
			if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
				this.isTrackingTransaction = false;
				this.download();
			} else if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
				alert("Sorry, unable to purchase");
			}
			
			this.updateBuyButtonLabel();
		}, this);
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
		if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
			alert("Unable to download folio.");
			this.download_completedSignalHandler(transaction);
		} else if (this.currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
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

		if (this.currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED)
			this.currentDownloadTransaction.resume();
		else
			this.currentDownloadTransaction.pause();
	},
	
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
	
	setDownloadPercent: function(value) {
		value *= .01;
		var maxWidth = 52; // 52 is max width of track.
		this.$el.find(".progress-bar-middle").css("width", Math.min(Math.max(maxWidth * value, 0), maxWidth) - 8); //  subtract 4 for the left and 4 for the right
	}
});
