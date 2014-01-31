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