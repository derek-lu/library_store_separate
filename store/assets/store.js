/**
 * Collection that represents the folios in the store.
 */

var ADOBE = ADOBE || {};

ADOBE.StoreCollection = Backbone.Collection.extend({
	// This parse method is only used when loading XML for testing without the API, ie: on the desktop.
	parse: function(xml) {
		var issueNodes = xml.getElementsByTagName("issue");
		var len = issueNodes.length;
		if (len > 0) {
			var issues = [];
			for (var i = 0; i < len; i++) {
				var issueNode = issueNodes[i];
				// Get the attributes
				var issue = {};
				var attributes = issueNode.attributes;
				issue.id = attributes.getNamedItem("id").value;
				issue.productId = attributes.getNamedItem("productId").value;
				issue.formatVersion = attributes.getNamedItem("formatVersion").value;
				issue.version = attributes.getNamedItem("version").value;
				issue.subpath = attributes.getNamedItem("subpath").value;
				
				// Loop through the nodes.
				var childNodes = issueNode.childNodes;
				var numNodes = childNodes.length;
				for (var j = 0; j < numNodes; j++) {
					var childNode = childNodes[j];
					if (childNode.nodeType == 1) {
						var nodeName = childNode.nodeName;
						if (nodeName == "libraryPreviewUrl") {
							issue[nodeName] = $.trim(childNode.firstChild.nodeValue);
						} else if (childNode.nodeName == "publicationDate") {
							// 2011-06-22T07:00:00Z.
							var pubDate = childNode.firstChild.nodeValue.split("-");
							var date = new Date(pubDate[0], Number(pubDate[1]) - 1, pubDate[2].substr(0, 2));
							issue[nodeName] = date;
						} else if (childNode.nodeName == "magazineTitle") { // Make the property match the API.
							issue["title"] = childNode.firstChild.nodeValue;
						} else {
							issue[nodeName] = childNode.firstChild.nodeValue;
						}
					}
				}
				
				issues.push(issue);
			}

			issues.sort(this.sortDatesDescending);

			return issues;
		}
		else
		{
			return null;
		}
	},
	
	sortDatesDescending: function (a, b) {
		if (a.publicationDate < b.publicationDate)
			return 1;
		else if (a.publicationDate > b.publicationDate)
			return -1;
		else
			return 0;
	}
});
(function($) {
$.fn.horizontalPageContainer = function(method) {
	if (this[0][method]) {
		return this[0][method].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return this.each(function() {
			var $this = $(this);

			var selectedIndex = 0;		// The current visible page.

			var ANIMATION_DURATION = .6;		// The duration to flick the content. In seconds.
			var MOVE_THRESHOLD = 10;			// Since touch points can move slightly when initiating a click this is the
												// amount to move before allowing the element to dispatch a click event.
												
			var pageWidth;
			
			var touchStartTransformX;			// The start transformX when the user taps.
			var touchStartX;					// The start x coord when the user taps.
			var interval;						// Interval used for measuring the drag speed.
			var wasContentDragged;				// Flag for whether or not the content was dragged. Takes into account MOVE_THRESHOLD.
			var targetTransformX;				// The target transform X when a user flicks the content.
			var touchDragCoords = [];			// Used to keep track of the touch coordinates when dragging to measure speed.
			var touchstartTarget;				// The element which triggered the touchstart.
			var viewPortWidth;					// The width of the div that holds the horizontal content.
			var navStatus;						// The canvas that will contain the nav circles.
			var navStatusContext;				// The context of the canvas.
			var $pageContainer;
			
			var isDrawNavStatusBackground;
			
			var numPages;
			
			init();
			
			function init() {
				$this[0].addEventListener("touchstart", touchstartHandler);
				$this[0].addEventListener("mousedown", touchstartHandler);
				
				isDrawNavStatusBackground = method.isDrawNavStatusBackground;
	
				viewPortWidth = method.viewPortWidth;
				
				$pageContainer = $this.find(".pages");
				
				// Get a reference to the canvas used to draw the scroll indicator.
				navStatus = $this.find(".navStatus");

				navStatusContext = navStatus[0].getContext("2d");

				_setNumPages(method.numPages || $pageContainer.children().length);

				$pageContainer.on("webkitTransitionEnd", transitionEndHandler);
			}

			function _setNumPages(value) {
				// Need to explicitly set the width otherwise the pages will wrap.
				$pageContainer.css("width", viewPortWidth * value);
				numPages = value;

				if (value > 0)
					drawNavStatus();
			}
			
			function touchstartHandler(e) {
				clearInterval(interval);
				
				wasContentDragged = false;
				
				// Transition in progress.
				if (targetTransformX != undefined && targetTransformX != getTransformX())
					dispatchTransitionEndEvent();
				
				// Prevent the default so the window doesn't scroll and links don't open immediately.
				e.preventDefault();	
				
				// Get a reference to the element which triggered the touchstart.
				touchstartTarget = e.target;
				
				// Check for device. If not then testing on desktop.
				touchStartX = window.Touch ? e.touches[0].clientX : e.clientX;
				
				// Get the current transformX before the transition is removed.
				touchStartTransformX = getTransformX();
				
				// Set the transformX before the animation is stopped otherwise the animation will go to the end coord
				// instead of stopping at its current location which is where the drag should begin from.
				setTransformX(touchStartTransformX);
				
				// Remove the transition so the content doesn't tween to the spot being dragged. This also moves the animation to the end.
				$pageContainer.css("-webkit-transition", "none");
				
				// Create an interval to monitor how fast the user is dragging.
				interval = setInterval(measureDragSpeed, 20);
				
				document.addEventListener("touchmove", touchmoveHandler);
				document.addEventListener("touchend", touchendHandler);
				document.addEventListener("mousemove", touchmoveHandler);
				document.addEventListener("mouseup", touchendHandler);
			}
			
			function measureDragSpeed() {
				touchDragCoords.push(getTransformX());
			}
			
			function touchmoveHandler(e) {
				var deltaX = (window.Touch ? e.touches[0].clientX : e.clientX) - touchStartX;
				if (wasContentDragged || Math.abs(deltaX) > MOVE_THRESHOLD) { // Keep track of whether or not the user dragged.
					wasContentDragged = true;
					setTransformX(touchStartTransformX + deltaX);
				}
			}
			
			function touchendHandler(e) {
				document.removeEventListener("touchmove", touchmoveHandler);
				document.removeEventListener("touchend", touchendHandler);
				document.removeEventListener("mousemove", touchmoveHandler);
				document.removeEventListener("mouseup", touchendHandler);
				
				clearInterval(interval);
				
				e.preventDefault();
				
				if (wasContentDragged) { // User dragged more than MOVE_THRESHOLD so transition the content. 
					var previousX = getTransformX();
					var bSwitchPages;
					// Compare the last 5 coordinates
					for (var i = touchDragCoords.length - 1; i > Math.max(touchDragCoords.length - 5, 0); i--) {
						if (touchDragCoords[i] != previousX) {
							bSwitchPages = true;
							break;
						}
					}
					
					// User dragged more than halfway across the screen.
					if (!bSwitchPages && Math.abs(touchStartTransformX - getTransformX()) > (viewPortWidth / 2))
						bSwitchPages = true;
		
					if (bSwitchPages) {
						if (previousX > touchStartTransformX) { // User dragged to the right. go to previous page.
							if (selectedIndex > 0) { // Make sure user is not on the first page otherwise stay on the same page.
								selectedIndex--;
							}
						} else { // User dragged to the left. go to next page.
							if (selectedIndex + 1 < numPages) {// Make sure user is not on the last page otherwise stay on the same page.
								selectedIndex++;
							}
						}
						
						tweenTo(- selectedIndex * viewPortWidth);
						
						drawNavStatus();
					} else {
						tweenTo(touchStartTransformX);
					}
				} else { // User dragged less than MOVE_THRESHOLD trigger a click event.
					var event = document.createEvent("MouseEvents");
					event.initEvent("click", true, true);
					touchstartTarget.dispatchEvent(event);
				}
			}
			
			function drawNavStatus() {
				navStatusContext.clearRect(0, 0, navStatus.width(), navStatus.height());
				
				navStatusContext.shadowOffsetX = 0;
				navStatusContext.shadowOffsetY = 0;
				navStatusContext.shadowBlur = 0;
				navStatusContext.shadowColor = "rgba(0, 0, 0, 0)";
				
				var horizontalGap = 10;
				var radius = 4;
				
				var totalWidth = numPages * radius * 2 + (numPages - 1) * horizontalGap;
				var centerX = Math.round((navStatus.width() - totalWidth) / 2);
				var centerY = radius * 2;
				
				if (isDrawNavStatusBackground) {
					// draw the background first. semi circles on each end with a rectangle in the middle.
					navStatusContext.fillStyle = "rgba(0, 0, 0, .2)";
					navStatusContext.beginPath();
					navStatusContext.arc(centerX - 4, centerY + 4, radius * 3, Math.PI * -1.5, Math.PI + Math.PI * -1.5)
					navStatusContext.closePath();
					navStatusContext.fill();
					
					navStatusContext.beginPath();
					navStatusContext.fillRect(centerX - 4, 0, totalWidth, radius * 6);
					navStatusContext.closePath();
					navStatusContext.fill();
					
					navStatusContext.beginPath();
					navStatusContext.arc(totalWidth + centerX - 4, centerY + 4, radius * 3, Math.PI * 1.5, Math.PI + Math.PI * 1.5)
					navStatusContext.closePath();
					navStatusContext.fill();
				}
				
				// Create an inset shadow.
				navStatusContext.shadowOffsetX = -1;
				navStatusContext.shadowOffsetY = -1;
				navStatusContext.shadowBlur = 0;
				navStatusContext.shadowColor = "rgba(0, 0, 0, 1)";

				for (var i = 0; i < numPages; i++) {
					navStatusContext.fillStyle = i == selectedIndex ? "rgb(255, 255, 255)" : "rgb(89, 89, 89)";
					navStatusContext.beginPath();
					navStatusContext.arc(centerX + ((radius * 2 + horizontalGap) * i) + 1, centerY + 5, radius, 0, Math.PI * 2, true); 
					navStatusContext.closePath();
					navStatusContext.fill();
				}
			}
			
			// Returns the x of the transform matrix.
			function getTransformX() {
				var transformArray = $pageContainer.css("-webkit-transform").split(","); // matrix(1, 0, 0, 1, 0, 0)
				var transformElement = $.trim(transformArray[4]); // remove the leading whitespace.
				return transformX = Number(transformElement); // Remove the ). 
			}
			
			// Sets the x of the transform matrix.
			function setTransformX(value) {
				$pageContainer.css("-webkit-transform", "translateX("+ Math.round(value) + "px)");
			}
			
			function tweenTo(value) {
				isAnimating = true;
				targetTransformX = value;
				// Set the style for the transition.
				$pageContainer.css("-webkit-transition", "-webkit-transform " + ANIMATION_DURATION + "s");
				
				// Need to set the timing function each time -webkit-transition is set.
				// The transition is set to ease-out.
				$pageContainer.css("-webkit-transition-timing-function", "cubic-bezier(0, 0, 0, 1)");
				setTransformX(targetTransformX);
			}
			
			function dispatchTransitionEndEvent() {
				$this.trigger("transitionEnd");
			}
			
			function transitionEndHandler() {
				if (targetTransformX == getTransformX()) {
					dispatchTransitionEndEvent();
				}
			}

			this.getSelectedIndex = function() {
				return selectedIndex;
			}

			// Resets the layout.
			this.reset = function() {
				selectedIndex = 0;
				_setNumPages($pageContainer.children().length);
				setTransformX(0);
			}

			this.setNumPages = function(value) {
				_setNumPages(value);
			}
		});
	} else {
		$.error( 'Method ' +  method + ' does not exist on jQuery.horizontalPageContainer' );
	} 
}

})(jQuery);
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
/**
 * Displays folios in the marquee.
 * The data does not come from a collection, rather a folio property is set.
 */
var ADOBE = ADOBE || {};

ADOBE.FolioMarqueeItemView = Backbone.View.extend({
	tagName:  "div",
	
	className: "page",
	
	template: _.template("<div class='text'><div class='title'></div><div class='sub-title'></div><div class='date'></div><div class='black-button' id='buy-button'></div><div class='state'></div></div><div class='image'><img width='299' height='387'></div>"),
	
	// The dialog asking whether or not to update the folio if an update is available.
	updateDialog: null,
	
	isTrackingTransaction: false,
	
	// A reference to the current downloadTransaction. Used to pause and resume a download.
	currentDownloadTransaction: null,
	
	// A reference to the original folio since the collection uses a cloned copy.
	folio: null,
	
	isBuyButtonEnabled: true,
	
	render: function() {
		this.$el.html(this.template());
		
		return this;
	},

	setModel: function(value) {
		if (!value || value == this.folio)
			return;

		if (this.folio) {
			this.folio.updatedSignal.remove(this.updatedSignalHandler, this);
			this.$el.off();
		}

		this.folio = value;
		this.$el.find(".title").html(this.folio.title);
		this.$el.find(".sub-title").html(this.folio.subTitle);
		this.$el.find(".date").html(this.folio.date);
		this.$el.find("img").attr("src", this.folio.img);

		if (ADOBE.isAPIAvailable) {
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
				
				this.trackTransaction();
			}
		} else {
			this.$el.find("#buy-button").html("$1.99");
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
				this.downloadStatus.appendTo(this.$el.find(".text"));
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
		var maxWidth = 120; // 120 is max width of track.
		this.$el.find(".progress-bar-middle").css("width", Math.min(Math.max(maxWidth * value, 0), maxWidth) - 8); //  subtract 4 for the left and 4 for the right
	}
});
/**
 * The main application file.
 */
var ADOBE = ADOBE || {};

ADOBE.AppView = Backbone.View.extend({
	el: $("body"),
	
	// Collection of folios.
	storeCollection: null,
	
	// The HTML for the subscribe buttons.
	subscriptions: "",
	
	folios: null,

	// The number of folios to display per page in the bottom horizontal scrolling view.
	numFoliosPerPage: 6,

	$marqueePage1: null,
	$marqueePage2: null,

	initialize: function(isAPIAvailable) {
		// Used to get the folios when testing on the desktop since the API is not available.
		// The value after "accountId=" should be updated with the publisher account id.
		// To find the account id, see the section titled Connecting to fulfillment in Building a custom storefront,
		// http://www.adobe.com/devnet/digitalpublishingsuite/articles/dps-custom-store.html.
		var FULFILLMENT_URL = "http://www.dpsapps.com/dps/v2_library_store_templates/fulfillment_proxy.php?accountId=ed04c68418b74672a98fdcbbb2d90878";
		
		// Whether or not this is an entitlement viewer. If true, then display the signin button, otherwise do not.
		// This should be updated by the publisher.
		var isEntitlementViewer = true;
		
		// Set a flag for the API availability in the ADOBE namespace.
		ADOBE.isAPIAvailable = isAPIAvailable;

		var loginLbl;
		var isShowSubscriptions = false;
		var subscriptions = "";
		if (isAPIAvailable) {
			// Put the FolioStates in the ADOBE namespace for easier lookup later.
			ADOBE.FolioStates = adobeDPS.libraryService.folioStates;
			
			// Sort the folios descending.
			var list = adobeDPS.libraryService.folioMap.sort(function (a, b) {
				if (a.publicationDate < b.publicationDate)
					return 1;
				else if (a.publicationDate > b.publicationDate)
					return -1;
				else
					return 0;
			});
 
			// list is an associative array so put them in a regular array.
			this.folios = [];
			for (var i in list) {
				this.folios.push(list[i]);
			}
			
			// If the latest folio is not purchasable then the user is entitled to it.
			// If true then do not display the subscription button.
			var latestFolio = this.folios[0];
			var userOwnsLatestFolio = false;
			if (latestFolio)
				userOwnsLatestFolio = !(latestFolio.state == ADOBE.FolioStates.PURCHASABLE || latestFolio.state == ADOBE.FolioStates.UNAVAILABLE || latestFolio.state == ADOBE.FolioStates.INVALID);
			
			if (!userOwnsLatestFolio) {
				// Loop through the subscriptions and populate the buttons.
				var availableSubscriptions = adobeDPS.receiptService.availableSubscriptions;
				for (var s in availableSubscriptions) {
					var availableSubscription = availableSubscriptions[s];
					if (availableSubscription.isActive()) { // Users owns a subscription so do not display the subscription menu option.
						isShowSubscriptions = false;
						break;
					} else { // Create a string for the subscription buttons.
						this.subscriptions += "<div class='subscribe-button' id='" + availableSubscription.productId + "'>" + availableSubscription.duration + " subscription for " + availableSubscription.price + "</div>";
						isShowSubscriptions = true;
					}
				}
			}
			
			// Determine the login label for the drop down menu.
			loginLbl = adobeDPS.authenticationService.isUserAuthenticated ? "Logout" : "Subscriber Login";
		} else { // Placeholder values for testing on the desktop.
			this.subscriptions += "<div class='subscribe-button' id='1year'>1 Year Subscription for $12.99</div>";
			this.subscriptions += "<div class='subscribe-button' id='1month'>1 Month Subscription for $1.99</div>";
			loginLbl = "Subscriber Login";
		}
		
		// Put everything in a container that has a fixed position so the elements do not reposition when a text input has focus.
		var html  = "<div class='fixed-container'>";
			html += "<div id='header'>";
		    html +=      "<div id='header-logo'></div>";
		    html +=      "<div id='restore-all-purchases'>Restore Purchases</div>";
		    
		    // If API is not available then testing on the desktop so show the button, otherwise only if this is an entitlement viewer.
			if (!isAPIAvailable || isEntitlementViewer)
		    	html +=  "<div id='print-subscriber'>" + loginLbl + "</div>";
		    
			// If API is not available then testing on the desktop so show the button, otherwise only if subscriptions are available.
		    if (!isAPIAvailable || (isShowSubscriptions && !userOwnsLatestFolio))
		   		html +=  "<div id='subscribe'>Subscribe</div>";
		    
		    html += "</div>";
		    
		    // The marquee to display featured items. The featured items are added below.
		    // If the API is available then the first two most recent folios are displayed in the marquee
		    // otherwise two placeholder items are displayed.
		    html += "<div id='marquee'>";
		    html +=      "<div class='pages'>";
		    
			// If API is not available then testing on the desktop so show the marquee item, otherwise only if subscriptions are available.
		    if (!isAPIAvailable || isShowSubscriptions) {
			    html +=           "<div class='page subscribe'>";
			    html +=                "<div class='text'>";
			    html +=                     "<div class='title'>Subscribe and Save</div>";
			    html +=                     "<div class='sub-title'>Join now for $11.99 a year!</div>";
			    html +=                     "<div class='date'>Save 75% off the cover price</div>";
			    html +=                     "<div id='marquee-subscribe-button' class='black-button'>$11.99</div>";
			    html +=                "</div>";
			    html +=                "<div class='image'><img src='http://lighthouse.adobe.com/dps/v2_library_store_templates/store/images/subscription_covers.png' width='352' height='332'></div>";
			    html +=           "</div>";
		    }
		    
		    html +=      "</div>";
		    html +=      "<canvas class='navStatus' width='768' height='30'></canvas>";
		    html += "</div>";
		    
		    // The grid to display the folios.
		    html += "<div id='folios'>";
		    html +=      "<div class='pages'>";
		    html +=      "</div>";
		    html +=      "<canvas class='navStatus' width='768' height='20'></canvas>";
		    html += "</div>";
		    
		    // The frame around the folio grid.
		    html += "<div id='folios-overlay-top'></div>";
		    html += "<div id='folios-overlay-left'></div>";
		    html += "<div id='folios-overlay-right'></div>";
		    html += "<div id='folios-overlay-bottom'></div>";
		    
			html += "</div>";
			
		// Uncomment the textarea below to enable debug output via debug().
		//html += "<textarea class='debug'></textarea>";
		window.debug = function(value) {
			$(".debug").val($(".debug").val() + ($(".debug").val() == "" ? "" : "\n") + value);
		}
		    
		$("body").html(html);
		
		var scope = this;
		$("#restore-all-purchases").on("click", function() {
			var restoreDialog = new ADOBE.RestoreDialog();
			$("body").append(restoreDialog.render().el);
			restoreDialog.open();
		})
		
		// Handler for when a user clicks the subscribe button in the marquee
		$("#marquee-subscribe-button").on("click", function() {
			
		});
		
		// Opens the login dialog or logs out the user.
		$("#print-subscriber").on("click", function() { scope.printSubscriber_clickHandler() });
		
		// Opens the subscribe dialog.
		$("#subscribe").on("click", function() {
			var subscribeDialog = new ADOBE.SubscribeDialog({model: scope.subscriptions});
			$("body").append(subscribeDialog.render().el);
			subscribeDialog.open();
		
			// Triggered from the dialog when a purchase is successful.
			$("body").on("subscriptionPurchased", function() {
				// Remove the subscribe button.
				$("#subscribe").remove();
				
				// Remove the subscribe page from the marquee.
				$("#marquee .subscribe").remove();
				$("#marquee").horizontalPageContainer("reset");
				
				$("body").off("subscriptionPurchased");
			});
		});

		var folio;
		if (ADOBE.isAPIAvailable) {
			this.$marqueePage1 =  new ADOBE.FolioMarqueeItemView();
			$("#marquee .pages").append(this.$marqueePage1.render().el);

			if (this.folios[0]){
				// Take the first folio and add it to the marquee.
				folio = this.folios[0];
				this.setMarqueeFirstFolioProperties(folio);
				this.$marqueePage1.setModel(folio);
			}

			this.$marqueePage2 = new ADOBE.FolioMarqueeItemView();
			$("#marquee .pages").append(this.$marqueePage2.render().el);

			if (this.folios[0]) {
				// Take the next folio and add it to the marquee.
				folio = this.folios[1];
				this.setMarqueeSecondFolioProperties(folio);
				this.$marqueePage2.setModel(folio);
			}

			// The collection creates a clone of the folio objects so addFolios() passes a reference to the object.
			// Since the folios are not on a server we don't need to load anything so pass the folios to the constructor.
			this.storeCollection = new ADOBE.StoreCollection(this.folios);
			this.addFirstTwoPages();

            // Add a listener for when new folios are added.
            adobeDPS.libraryService.folioMap.addedSignal.add(function(folios) {
				for (var i = 0; i < folios.length; i++) {
					scope.addFolio(folios[i]);
				}
			}, this);
		} else {
			var view;

			// Add the first placeholder marquee page.
			folio = {};
			folio.title = "Glitz & Glamour";
			folio.subTitle = "The Style Issue";
			folio.date = "August 2012";
			folio.img = "http://lighthouse.adobe.com/dps/v2_library_store_templates/store/images/marquee_2.png";
			view = new ADOBE.FolioMarqueeItemView();
			$("#marquee .pages").append(view.render().el);
			view.setModel(folio);

			// Add the second placeholder marquee page.
			folio.title = "Shop The Look";
			folio.subTitle = "The Street Chic Issue";
			folio.date = "July 2012";
			folio.img = "http://lighthouse.adobe.com/dps/v2_library_store_templates/store/images/marquee_3.png";
			view = new ADOBE.FolioMarqueeItemView();
			$("#marquee .pages").append(view.render().el);
			view.setModel(folio);

			_.bindAll(this, "addFirstTwoPages");
			this.storeCollection = new ADOBE.StoreCollection();
			this.storeCollection.url = FULFILLMENT_URL;
			this.storeCollection.on("all", this.addFirstTwoPages);
			this.storeCollection.fetch({dataType: "xml"});
		}
		
		// Wait for the marquee items to be added before creating the control.
		var marquee = $("#marquee").horizontalPageContainer({viewPortWidth: 768, isDrawNavStatusBackground: true});
	},

	setMarqueeFirstFolioProperties: function(folio) {
		// Add additional data that will be displayed in the marquee. This data is not available from the API.
		folio.subTitle = "The Style Issue";
		folio.date = "March 2012";
		folio.img = "http://lighthouse.adobe.com/dps/v2_library_store_templates/store/images/marquee_2.png";
	},

	setMarqueeSecondFolioProperties: function(folio) {
		// Add additional data that will be displayed in the marquee. This data is not available from the API.
		folio.subTitle = "The Street Chic Issue";
		folio.date = "February 2012";
		folio.img = "http://lighthouse.adobe.com/dps/v2_library_store_templates/store/images/marquee_3.png";
	},
	
	addFirstTwoPages: function() {
		var len = this.storeCollection.length;
		$("#folios").horizontalPageContainer({viewPortWidth: 768, numPages: Math.ceil(len / 6), isDrawNavStatusBackground: false});

		var scope = this;
		$("#folios").on("transitionEnd", function(){ scope.transitionEndHandler() });

		this.addPage(0);
		this.addPage(1);
	},
	
	// Adds a page of 6 folios, 2 columns x 3 rows.
	addPage: function(pageIndex) {
		var $pages = $("#folios .pages");
		
		if (pageIndex > $pages.children().length - 1) {
			// Make sure not to go above the number of folios.
			var len = Math.min(this.numFoliosPerPage * (pageIndex + 1), this.storeCollection.length - 2); // Take into account the folios in the marquee
			var startIndex = this.numFoliosPerPage * pageIndex;
			if (startIndex < len) {
				var page = $("<div class='page'></div>").appendTo($pages);
				for (var i = startIndex; i < len; i++) {
					// When using the DPS api this is a clone of the original folio.
					var folio = this.storeCollection.at(i + 2); // Take into account the folios in the marquee
					
					// Testing on the desktop so set create the path to the image.
					if (!ADOBE.isAPIAvailable)
						folio.attributes.libraryPreviewUrl +=  "/portrait";
					
					var view = new ADOBE.FolioItemView({model: folio});
					page.append(view.render().el);
				}
			}
		}
	},

	addFolio: function(folio) {
		var len = this.storeCollection.length;
		// Find the insert index. Folios are sorted by publicationDate with the most recent first.
		for (var i = 0; i < len; i++) {
			if (folio.publicationDate >= this.storeCollection.at(i).attributes.publicationDate) {
				break;
			}
		}

		// Add the folio to the collection.
		this.storeCollection.add(folio, {at: i});

		len += 1;

		var folioToAdd;
		if (i == 0 || i == 1) { // The two most recent folios are displayed in the marquee so update the marquee.
			if (i == 0) {
				// Set the second marquee folio with the first marquee folio.
				if (this.$marqueePage1.folio) {
					this.setMarqueeSecondFolioProperties(this.$marqueePage1.folio);
					this.$marqueePage2.setModel(this.$marqueePage1.folio);
				}
				// Set the folio for the first marquee with the one just added.
				this.setMarqueeFirstFolioProperties(folio);
				this.$marqueePage1.setModel(folio);
			} else {
				this.setMarqueeSecondFolioProperties(folio);
				this.$marqueePage2.setModel(folio);
			}

			// If there are more than 2 folios then the 3rd one is always the one to add.
			if (len > 2)
				folioToAdd = this.storeCollection.at(2);
		} else {
			folioToAdd = folio;
		}

		if (!folioToAdd)
			return;

		i -= 2; // Subtract two since the first two folios are in the marquee
		i = Math.max(0, i);

		var $pages = $("#folios .pages");
		var numPages = $pages.children().length;

		// Add the pages if necessary.
		// If there aren't any pages add one. Also add another page as a buffer if needed.
		if (numPages == 0 || (numPages == 1 && len > this.numFoliosPerPage)) {
			$("<div class='page'></div>").appendTo($pages);
			numPages += 1;
		}

		if (i < this.numFoliosPerPage * numPages) { // Only add the view if it will be added to an already existing page.
			// Create a view for the folio.
			var view = new ADOBE.FolioItemView({model: this.storeCollection.at(i + 2)});
			var el = view.render().el;

			// The pageIndex the folio will be added to.
			var pageIndex = Math.floor(i / this.numFoliosPerPage);

			// The page view the folio will be added to.
			var $page = $("#folios div.page").eq(pageIndex);

			if ($page.children().length == 0) { // If there aren't any children on the current page then add it.
				$page.append(el);
			} else {
				// Use the page that the folio should be added to and then find the div
				// it should be inserted before.
				$page.find("div.folio-item-view").eq(i % this.numFoliosPerPage).before(el);

				// Loop through the pages.
				for (i = pageIndex; i < numPages; i++) {
					$page = $("#folios div.page").eq(i);
					if (i + 1 < numPages) { // Not on the last page.
						// If there are too many folio views on this page then remove the last one
						// and place it on the next page.
						if ($page.children().length > this.numFoliosPerPage) {
							// Remove the last child from the current page.
							var $view = $page.find("div.folio-item-view:last-child").detach();

							// Add the child that was just removed to the beginning of the next page
							var $nextPage = $("#folios div.page").eq(i + 1);
							if ($nextPage.children().length == 0) // No children so just add it to the page.
								$nextPage.append($view);
							else // There are already children so add it before the first one.
								$nextPage.find("div.folio-item-view").eq(0).before($view);
						}
					} else { // On the last page.
						// If there are too many folio views on the last page remove the last one.
						if ($page.children().length > this.numFoliosPerPage)
							$page.find("div.folio-item-view:last-child").remove()
					}
				}
			}
		}

		$("#folios").horizontalPageContainer("setNumPages", Math.ceil(len / 6));
	},
	
	// Handler for when the HorizontalPageContainer stops transitioning.
	transitionEndHandler: function() {
		this.addPage($("#folios").horizontalPageContainer("getSelectedIndex") + 1);
	},
	
	printSubscriber_clickHandler: function() {
		if (!ADOBE.isAPIAvailable || !adobeDPS.authenticationService.isUserAuthenticated) {
			this.displayLoginDialog();
		} else {
			adobeDPS.authenticationService.logout();
			$("#print-subscriber").html("Subscriber Login");				
		}
	},
	
	displayLoginDialog: function() {
		var loginDialog = new ADOBE.LoginDialog();
		$("body").append(loginDialog.render().el);
		loginDialog.open();
		
		// Triggered from the dialog when a login is successful.
		loginDialog.$el.on("loginSuccess", function() {
			$("#print-subscriber").html("Logout");
		});
	}
});