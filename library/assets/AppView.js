/**
 * The main application file.
 */
var ADOBE = ADOBE || {};

ADOBE.AppView = Backbone.View.extend({
	el: $("body"),
	
	// Stores the FolioItemView instances.
	folioItemViewArray: [],
	
	// Displays the grid of folios.
	$grid: null,
	
	// Displays the one-up view of folios.
	$largeView: null,
	
	libraryCollection: null,
	
	initialize: function(isAPIAvailable) {
		// Used to get the folios when testing on the desktop since the API is not available.
		// The value after "accountId=" should be updated with the publisher account id.
		// To find the account id, see the section titled Connecting to fulfillment in Building a custom storefront,
		// http://www.adobe.com/devnet/digitalpublishingsuite/articles/dps-custom-store.html.
		var FULFILLMENT_URL = "http://www.dpsapps.com/dps/v2_library_store_templates/fulfillment_proxy.php?accountId=ed04c68418b74672a98fdcbbb2d90878";
		
		// Set a flag for the API availability in the ADOBE namespace.
		ADOBE.isAPIAvailable = isAPIAvailable;
		
		if (isAPIAvailable) {
			// Put the FolioStates in the ADOBE namespace for easier lookup later.
			ADOBE.FolioStates = adobeDPS.libraryService.folioStates;
		}
		
		var isShowDropDown = !isAPIAvailable || adobeDPS.settingsService.autoArchive.isSupported;
		
		var html  = "<div id='header'>";
		    html +=     "<div class='navbar' id='navbar' default-selected-index='1'>";
		    html +=         "<div off-skin-style='view-toggle-big-off' on-skin-style='view-toggle-big-on'></div>";
		    html +=         "<div off-skin-style='view-toggle-grid-off' on-skin-style='view-toggle-grid-on'></div>";
		    html +=     "</div>";
		    
		    // If testing on desktop then include the switch otherwise make sure it is supported.
		    if (isShowDropDown) {
			    html += "<div class='drop-down' id='header-drop-down'>";
		   		html +=     "<div id='auto-archive' class='flip-switch' state='" + (!isAPIAvailable || adobeDPS.settingsService.autoArchive.isEnabled ? "on" : "off") + "'>Auto Archive</div>";
		   	    html += "</div>";
		    } 
		    // The toggle button to show the "archive" buttons.
		    html +=     "<div class='toggle-button' id='edit-button' up-skin-style='black-button' selected-skin-style='blue-button'></div>";
		    html += "</div>";
		    
		    // The container to hold the grid of folios.
		    html += "<div id='grid'>";
		    html += "</div>";
			
		// Uncomment the textarea below to enable debug output via debug().
		//html += "<textarea class='debug'></textarea>";
		window.debug = function(value) {
			$(".debug").val($(".debug").val() + ($(".debug").val() == "" ? "" : "\n") + value);
		}
		    
		$("body").html(html);
		
		// Init the controls.
		$("#navbar").navbar();
		$("#edit-button").toggleButton({upLabel: "Edit", selectedLabel: "Done"});
		
		if (isShowDropDown)
			$("#header-drop-down").dropDown({verticalGap: 17});
		
		var scope = this;
		
		// Handler for the auto archive switch in the drop down.
		$("body").on("change", "#auto-archive", function(e, isOn){ scope.autoArchive_changeHandler(e, isOn) });

		// Toggles between grid and one-up view.
		$("#navbar").on("change", function(e){ scope.navbar_changeHandler(e) });
		
		// Handler to toggle the archive buttons.
		$("#edit-button").on("click", function(e){ scope.editButtonClickHandler(e) });
		
		if (ADOBE.isAPIAvailable) {
			var list = adobeDPS.libraryService.folioMap.sort(function (a, b) {
				if (a.publicationDate < b.publicationDate)
					return 1;
				else if (a.publicationDate > b.publicationDate)
					return -1;
				else
					return 0;
			});
			
			// list is an associative array so put them in a regular array.
			var folios = [];
			for (var i in list) {
				var state = list[i].state;
				// Since this is a library only, only display the folios that the user has saved or is in the process of saving.
				if (state == ADOBE.FolioStates.DOWNLOADING || 
					state == ADOBE.FolioStates.PURCHASING ||
					state == ADOBE.FolioStates.EXTRACTING ||
					state == ADOBE.FolioStates.INSTALLED ||
					state == ADOBE.FolioStates.EXTRACTABLE) {
					folios.push(list[i]);
				}
			}
			
			if (folios.length > 0) {
				// The collection creates a clone of the folio objects so addFolios() passes a reference to the object.
				// Since the folios are not on a server we don't need to load anything so pass the folios to the constructor.
				this.libraryCollection = new ADOBE.LibraryCollection(folios);
				this.addFolios();
			} else {
				$("<div class='no-saved-folios'>You do not have any saved magazines.<br>To purchase a magazine please go to the store.</div>").appendTo("#grid");
			}
		} else { // Display all of the folios.
			_.bindAll(this, "addFolios");
			this.libraryCollection = new ADOBE.LibraryCollection();
			this.libraryCollection.url = FULFILLMENT_URL;
			this.libraryCollection.on("all", this.addFolios);
			this.libraryCollection.fetch({dataType: "xml"});
		}
		
		// Handler for when a user clicks to delete a folio.
		$("body").on("folioArchived", ".folio-item-view", function(e){ scope.folioArchivedHandler(e) });
	},
	
	addFolios: function(event) {
		var len = this.libraryCollection.length;
		
		for (var i = 0; i < len; i++) {
			// When using the DPS api this is a clone of the original folio.
			var folio = this.libraryCollection.at(i);
			
			// Testing on the desktop so set create the path to the image.
			if (!ADOBE.isAPIAvailable)
				folio.attributes.libraryPreviewUrl +=  "/portrait";
			
			var view = new ADOBE.FolioItemView({model: folio});
			var el = view.render().el;
			$("#grid").append(el);
			
			view.$el.css({left: (25 + (i % 4) * (25 + 160)) + "px", top: Math.floor(i / 4) * 294 + 68});
			view.$el.attr("id", folio.attributes.productId);
			
			this.folioItemViewArray.push(view);
		}
		
		// Explcitly size the height of grid so the background image repeats to the correct height
		// since we are using absolute coordinates. minHeight is set via CSS.
		$("#grid").css("height", Math.ceil(i / 4) * 294);
	},
	
	// Handler for when a user changes the auto archive setting.
	autoArchive_changeHandler: function(e, isOn) {
		adobeDPS.settingsService.autoArchive.toggle(isOn);
	},
	
	// Handler for when a folio has been successfully archived.
	folioArchivedHandler: function(e) {
		// slideshow doesn't support removing items so remove it so a new slideshow is created when that view is toggled.
		if (this.$largeView) {
			this.$largeView.remove();
			this.$largeView = null;
		}
		
		var $el = $(e.currentTarget);

		// Remove the model from the collection. This is so the largeview is properly updated.
		var model = this.libraryCollection.where({productId: $el.attr("id")})[0];
		this.libraryCollection.remove(model, {silent: true});
		
		// Fadeout the deleted folio first.
		$el.css("-webkit-transform", "none");
		$el.css("opacity", "0");
		$el.css("-webkit-transition", "all .3s");
		$el.css("-webkit-transition-timing-function", "cubic-bezier(0, 0, 0, .5)");
		var transitionCount = 0;
		var scope = this;
		$el[0].addEventListener("webkitTransitionEnd", function() {
			if (transitionCount == 1)
				scope.deleteFolioHandler($el);
			
			transitionCount += 1;
		});
	},
	
	// Handler for when the folio has faded out. This method repositions the remaining folios.
	deleteFolioHandler: function($el) {
		var removeIndex = $el.index();
		this.folioItemViewArray.splice(removeIndex, 1);
		$el.remove();
		
		var len = this.folioItemViewArray.length;
		for (var i = removeIndex; i < len; i++) {
			var $el = this.folioItemViewArray[i].$el;
			(function (i, $el) {
				setTimeout(function () {
					$el.css({left: (25 + (i % 4) * (25 + 160)) + "px", top: Math.floor(i / 4) * 294 + 68});
					$el.css("-webkit-transition", "all .2s");
					$el.css("-webkit-transition-timing-function", "cubic-bezier(0, 0, 0, .5)");
				}, (i - removeIndex) * 100) // Stagger the transition of each folio view.
			})(i, $el);
		}
		
		setTimeout(function() {
			// Explcitly size the height of grid so the background image repeats to the correct height
			// since we are using absolute coordinates. minHeight is set via CSS.
			$("#grid").css("height", Math.ceil(len / 4) * 294);
		}, (i - removeIndex + 1) * 100); // Set a delay so the resize isn't done until the transitions above are complete.
	},
	
	navbar_changeHandler: function(e) {
		var selectedIndex = $(e.currentTarget).navbar("getSelectedIndex");
		if (selectedIndex == 0) { // Display the large view.
			this.$grid = $("#grid").detach();
			$("#edit-button").css("display", "none");
			
			var isInited = true;
			if (!this.$largeView) {
				this.$largeView = $("<div id='large-view-wrapper'><div id='large-view' class='slideshow'></div></div>");
				isInited = false;
			}
			
			this.$largeView.appendTo("body");
			
			// Need to wait until after $largeView has been added to the DOM in order to create the slideshow.
			if (!isInited) {
				$("#large-view").slideshow({
											renderer: ADOBE.LargeFolioItemView, // Renders each item in the slideshow.
											data: this.libraryCollection,		// The data used to pass to each renderer.
											itemWidth: 600,						// The width of each item.
											horizontalGap: 30,
										 });
			}
			
		} else { // Display the grid view. This is the default view.
			this.$largeView.detach();
			this.$grid.appendTo("body");
			$("#edit-button").css("display", "inline");
		}
	},
	
	// Handler for when a user clicks the edit button.
	// This will display the archive button for folios that can be archived.
	editButtonClickHandler: function(e) {
		var isShowArchiveButton = !$(e.currentTarget).toggleButton("getState");
		var len = this.folioItemViewArray.length;
		for (var i = 0; i < len; i++) {
			this.folioItemViewArray[i].showArchiveButton(isShowArchiveButton);
		}
	},
});