sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/Sorter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/FilterType",
	"sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, MessageBox, Sorter, Filter, FilterOperator, FilterType, JSONModel) {
	"use strict";

	return Controller.extend("sap.ui.core.tutorial.odatav4.controller.App", {

		/**
		 *  Hook for initializing the controller
		 */
		onInit : function () {
			// The parameters passed into the bindList function define the sPath, oContext, aSorters, aFilters, etc.
			// The filter under Mesasge Model Binding fetches all messages of type "technical".
			var oMessageManager = sap.ui.getCore().getMessageManager(),
				oMessageModel = oMessageManager.getMessageModel(),
				oMessageModelBinding = oMessageModel.bindList("/", undefined, [],
					new Filter("technical", FilterOperator.EQ, true)),
				oViewModel = new JSONModel({
					busy: false,
					hasUIChanges: false,
					usernameEmpty: true,
					order: 0
				});
			this.getView().setModel(oViewModel, "appView");
			this.getView().setModel(oMessageModel, "message");

			oMessageModelBinding.attachChange(this.onMessageBindingChange, this);
			this._bTechnicalErrors = false;
		},

		onCreate: function () {
			var oList = this.byId("peopleList"),
				oBinding = oList.getBinding("items"),
				oContext = oBinding.create({
					"UserName" : "",
					"FirstName" : "",
					"LastName" : "",
					"Age" : "18"
				});

			this._setUIChanges();
			this.getView().getModel("appView").setProperty("/usernameEmpty", true);

			oList.getItems().some(function (oItem) {
				if (oItem.getBindingContext() === oContext) {
					oItem.focus();
					oItem.setSelected(true);
					return true;
				}
			});
		},

		onDelete: function () {
			var oSelected = this.byId("peopleList").getSelectedItem();

			if(oSelected) {
				oSelected.getBindingContext().delete("$auto").then(function () {
					MessageToast.show(this._getText("deletionSuccessMessage"));
				}.bind(this), function(oError) {
					MessageBox.error(oError.message);
				});
			}
		},

		onInputChange: function (oEvt) {
			if (oEvt.getParameter("escPressed")) {
				this._setUIChanges();
			} else {
				this._setUIChanges(true);
				if (oEvt.getSource().getParent().getBindingContext().getProperty("UserName")) {
					this.getView().getModel("appView").setProperty("/usernameEmpty", false);
				}
			}
		},

		onRefresh: function () {
			// Getting the current data binding of the table with id "peopleList"
			var oBinding = this.byId("peopleList").getBinding("items");

			if(oBinding.hasPendingChanges()) {
				MessageBox.error(this._getText("refreshNotPossibleMessage"));
				return;
			}
			oBinding.refresh();
			MessageToast.show(this._getText("refreshSuccessMessage"));
		},

		onResetChanges: function () {
			this.byId("peopleList").getBinding("items").resetChanges();
			this._bTechnicalErrors = false;
			this._setUIChanges();
		},

		onResetDataSource: function () {
			var oModel = this.getView().getModel(),
				oOperation = oModel.bindContext("/ResetDataSource(...)");

			oOperation.execute().then(function () {
				oModel.refresh();
				MessageToast.show(this._getText("sourceResetSuccessMessage"));
			}.bind(this), function (oError) {
				MessageBox.error(oError.message);
			});
		},

		onSave: function () {
			var fnSuccess = function () {
				this._setBusy(false);
				MessageToast.show(this._getText("changesSentMessage"));
				this._setUIChanges(false);
			}.bind(this);

			var fnError = function (oError) {
				this._setBusy(false);
				this._setUIChanges(false);
				MessageBox.error(oError.message);
			}.bind(this);

			this._setBusy(true); // Lock UI until submitBatch is resolved.
			this.getView().getModel().submitBatch("peopleGroup").then(fnSuccess, fnError); // Submits our changes.
			this._bTechnicalErrors = false; // If there were technical errors, a new save resets them.
		},

		onSearch: function () {
			var oView = this.getView(),
				sValue = oView.byId("searchField").getValue(),
				oFilter = new Filter("LastName", FilterOperator.Contains, sValue);

				oView.byId("peopleList").getBinding("items").filter(oFilter, FilterType.Application);
		},

		onSort: function () {
			var oView = this.getView(),
				aStates = [undefined, "asc", "desc"],
				aStateTextIds = ["sortNone", "sortAscending", "sortDescending"],
				sMessage,
				iOrder = oView.getModel("appView").getProperty("/order");

			iOrder = (iOrder + 1) % aStates.length;
			var sOrder = aStates[iOrder];

			oView.getModel("appView").setProperty("/order", iOrder);
			/*
			The sorter function's second parameter is a boolean parameter for descending sort. If descending sort is
			to be done, it must be true, else it has to be false. This new sorter will only be applied when sOrder
			is defined. Otherwise the sort function will not get any Sorter object and therefore will not apply
			any kind of sorting on the list.
			*/
			oView.byId("peopleList").getBinding("items").sort(sOrder && new Sorter("LastName", sOrder === "desc"));

			sMessage = this._getText("sortMessage", [this._getText(aStateTextIds[iOrder])]);
			MessageToast.show(sMessage);
		},

		onMessageBindingChange: function (oEvent) {
			var aContexts = oEvent.getSource().getContexts(),
				aMessages,
				bMessageOpen = false;

			if (bMessageOpen || !aContexts.length) {
				return;
			}

			// Extract and remove the technical messages
			aMessages = aContexts.map(function (oContext) {
				return oContext.getObject();
			});
			sap.ui.getCore().getMessageManager().removeMessages(aMessages);

			this._setUIChanges(true);
			this._bTechnicalErrors = true;
			MessageBox.error(aMessages[0].message, {
				id: "serviceErrorMessageBox",
				onClose: function () {
					bMessageOpen = false;
				}
			});

			bMessageOpen = true;
		},

		onSelectionChange: function (oEvent) {
			var oDetailArea = this.byId("detailArea"),
				oLayout = this.byId("defaultLayout"),
				// get binding of selected item
				oUserContext = oEvent.getParameters().listItem.getBindingContext(),
				oOldContext = oDetailArea.getBindingContext(),
				oSearchField = this.byId("searchField");

			// remove keepAlive from old context
			if (oOldContext) {
				oOldContext.setKeepAlive(false);
			}

			// set binding
			oDetailArea.setBindingContext(oUserContext);
			
			// set keepAlive for new context and add a beforeDestroy function to the User Context
			oUserContext.setKeepAlive(true, function () {
				// hides detail area when context is destroyed
				oLayout.setSize("100%");
				oLayout.setResizable(false);
				oDetailArea.setVisible(false);
				oSearchField.setWidth("25%");
			});

			// resize view
			oDetailArea.setVisible(true);
			oLayout.setSize("60%");
			oLayout.setResizable(true);
			oSearchField.setWidth("40%");
		},

		_getText: function (sTextId, aArgs) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sTextId, aArgs);
		},

		_setUIChanges: function (bHasUIChanges) {
			if (this._bTechnicalErrors) {
				// IF there is currently a technical error, then force 'true'.
				bHasUIChanges = true;
			} else if (bHasUIChanges === undefined) {
				bHasUIChanges = this.getView().getModel().hasPendingChanges();
			}
			var oModel = this.getView().getModel("appView");
			oModel.setProperty("/hasUIChanges", bHasUIChanges);
		},

		_setBusy: function (bIsBusy) {
			var oModel = this.getView().getModel("appView");
			oModel.setProperty("/busy", bIsBusy);
		}
	});
});