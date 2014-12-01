$(function() {

  // shows some feedback from qbox-adapter (set to false to reduce console clutter)
  Ember.ENV.DEBUG = false;

  // turns off annoying depracation message
  //Ember.FEATURES['ember-routing-drop-deprecated-action-style'] = true 

  // app definition and params ///////////////////////////

  window.App = Ember.Application.create({
    // create ember app in the right element
     rootElement: '#ember_app_container',
     customEvents: {
       // add support for the keyUp event
       keyup: "handleKeyUp"
     }
    //LOG_TRANSITIONS: true
  });


  // configuration ///////////////////////////
  App.Config = window.table_config;
  if(!App.Config) {
    console.error('table_config object not found. table-config.js must be loaded before dynamic-table-map.js.');
    return;
  }

  // a little feedback
  console.debug("table_config object found. AJAX_ENDPOINT is " + $AJAX_ENDPOINT);
  // console.debug(
  //   Handlebars.compile("table_config object found. Index name is '{{index_name}}'. Type name is '{{type_name}}'.")
  //     ({
  //       index_name : App.Config.index_name, 
  //       type_name : App.Config.type_name
  //     })
  // );


  // template integration ///////////////////////////

  

  Ember.TEMPLATES['application'] = Ember.Handlebars.compile(App.Config.app_template);

  for(var i=0; i < App.Config.model_config_list.length; i++){
    Ember.TEMPLATES['documents' + i] = Ember.Handlebars.compile(App.Config.model_config_list[i].table_template);
    //Ember.TEMPLATES['document' + i] = Ember.Handlebars.compile(App.Config.model_config_list[i].details_template);
  }


  // model config

  App.Config.currentModelIndex = 0

  App.Config.getModelConfig = function() {
    return App.Config.model_config_list[App.Config.currentModelIndex];
  }

  App.Config.updateModelConfig = function() {
    if (Ember.ENV.DEBUG) console.debug("App.Config.updateModelConfig, App.Config.currentModelIndex: ", App.Config.currentModelIndex);

    objectConfig = App.Config.getModelConfig();

    App.Document = Ember.Object.extend(objectConfig.model_base);
    // workaround for Ember bug (didn't want to update Ember)
    // App.Document.toString = function() { return "App.Document"; }

    //if (Ember.ENV.DEBUG) console.debug("App.Config.updateModelConfig, App.Document: " + App.Document);

    App.ApplicationControllerInstance.set('model_title', App.Config.getModelConfig().model_title);

  };


  // authentication


  // data 

  App.Data = {

    textQuery: null,

    searchParams: {
      from: 0,
      size: App.Config.default_result_size,
      query: { "match_all" : {} }
    },

    totalHitCount: 0,

    resetSearchParams: function() {
      App.Data.textQuery = { "match_all" : {} };

      //console.log("***", App.Data.textQuery);

      App.Data.searchParams = {
        from: 0,
        size: App.Config.default_result_size,
        query: App.Data.textQuery
      };

      //console.log("***", App.Data.searchParams);

      if(App.Faceting.enabled){
        this.searchParams.facets = {};
        App.Config.getModelConfig().facet_properties.forEach(function(name){
          App.Data.searchParams.facets[name] = { 
            "terms" : { 
              "field" : name,
              "size" : App.Faceting.facetPageSize
            } 
          };
        });
        App.Faceting.clearFacetSelections();
        App.FacetSelectionsControllerInstance.getData();
      }
      else App.Faceting.enabled = false;

      App.DocumentsControllerInstance.set('perPage', App.Config.default_result_size);

      if(App.Config.getModelConfig().default_sort_property != undefined && App.Config.getModelConfig().default_sort_property){
        App.DocumentsControllerInstance.sortByProperty(App.Config.getModelConfig().default_sort_property, App.Config.getModelConfig().default_sort_direction);
      }
      else App.DocumentsControllerInstance.getData();
      App.FacetsControllerInstance.getData();
    },

    executeSearch: function() {
      $.ajax({
        url : $AJAX_ENDPOINT + "/" + App.Config.getModelConfig().model_name + "/_search",
        type: 'POST',
        contentType:"application/json",
        dataType : "json",
        // data: JSON.stringify({
        //   "server_token": App.Authentication.server_token,
        //   "client_token": App.Authentication.client_token,
        //   "username": App.ApplicationControllerInstance.username,
        //   "es_request": App.Data.searchParams
        // }),
        data: JSON.stringify(App.Data.searchParams),
        success: this.processSearchResult,
        error: function(err) { console.debug("AJAX error: ", err); }
      });
    },

    processSearchResult: function(json){
      // if(!json.authenticated){
      //   App.Authentication.handleBadSession(json);
      //   return { 
      //     "hits": {
      //       "hits": [],
      //       "total": 0
      //     },
      //     "facets": {}
      //   };
      // }
      // var es_data = json.es_response;
      var es_data = json;
      var use_fields = App.Config.getModelConfig().use_fields;
      var results = es_data['hits']['hits'].map( function(i) {
        var j = {};
        if (use_fields){
          for(var prop in i['fields']) 
            j[prop] = i['fields'][prop][0];
        }
        else {
          for(var prop in i['_source']) 
            j[prop] = i['_source'][prop];
          // j = i['_source'];
        }
        for(var prop in j) {
          if (prop == 'time') continue;
          var val = j[prop];
          val = Number(val.toPrecision(6))
          if (val > 3e6 || val < 1e-4){
            // console.debug(val.toPrecision(8));
            val = val.toExponential();
          }
          j[prop] = val;
        }
        // return Ember.Object.create(i['_source']).reopen({id: i._id, version: i._version});
        return Ember.Object.create(j).reopen({id: i._id, version: i._version});
      } );
      // console.debug(results);
      //results = results.map(function(i))
      var facets = [];
      for(var facet in es_data['facets']){
        var words = facet.split('.')[0].split('_').map(function(i){ 
          if (i == 'of') return i;
          if (i == 'cl') return 'CL';
          return i.charAt(0).toUpperCase() + i.slice(1); 
        });
        facetDisplayName = words.join(' ');
        facet.charAt(0).toUpperCase() + facet.slice(1);
        facets.push({
          name: facet,
          displayName: facetDisplayName,
          hasMore: (es_data['facets'][facet]['other'] > 0),
          terms: es_data['facets'][facet]["terms"].map(function(i){
            return {
              term: i.term,
              count: i.count,
              facet: facet,
              facetDisplayName: facetDisplayName
            }
          })
        });
      }
      // if (Ember.ENV.DEBUG) {
      //   console.debug('App.Data.processSearchResult: ', es_data['hits']['hits'], {'facets': facets});
      //   console.debug('------------------------------------------------------');
      // }
      App.Data.totalHitCount = es_data['hits']['total'];
      App.DocumentsControllerInstance.set('totalHitCount', App.Data.totalHitCount);
      if(App.Faceting.enabled){
        App.Faceting.facetData = facets;
        App.FacetsControllerInstance.getData();
      }
      //return result;
      //console.log(Ember.Array)
      App.DocumentsControllerInstance.set('model', results);

      App.Data.plotSearchResults(es_data['hits']['hits'].map(function(i) { return i['_source'] }));
    },

    plotSearchResults: function(results){

      var self = this;

      var y_key = App.DocumentsControllerInstance.get('sortBy');

      if (!self.chartDataList) self.chartDataList = [];
      if(!self.lastPlotField) self.lastPlotField = null;

      if (self.lastPlotField != y_key) {
        self.lastPlotField = y_key;
        self.chartDataList.push([{}, {}, y_key]);
      };

      if (self.chartDataList.length > $('.chart').length)
        self.chartDataList.shift();
      
      self.chartDataList = self.chartDataList.map(function(item) {
        return self.getChartData(item[2], results);
      });
      
      self.chartDataList.map(function(data,i) {
        $.plot($("#chart"+(i+1)), data[0], data[1]);
      })

    },

    getChartData: function(y_key, results){
      // console.log(y_key, results);
      var log10 = Math.log(10);

      var anchor_field = App.Config.getModelConfig().anchor_field;
      var time_field = App.Config.getModelConfig().time_field;

      // console.log(s_min, s_max, s_max/s_min);

      var data = { times: [], counts: [], ticks: [], mean: [], max: [], min: [], varn: [] };

      if (y_key == time_field) {

        var s_max = results.reduce(function(a,b){ return(a[anchor_field] > b[anchor_field]) ? a : b; })[anchor_field];
        var s_min = results.reduce(function(a,b){ return(a[anchor_field] <= b[anchor_field]) ? a : b; })[anchor_field];
        var use_log = (s_max/s_min > 300);

        var time_sorted = results.map(function(i){ return i; });

        time_sorted.sort(function(a,b) { return (Number(a['time']) < Number(b['time'])) ? -1 : 1; });

        $.each(time_sorted, function(idx, point) {
          var ind = new Date(Number(point[time_field]));
          data.times.push([ind, use_log ? (Math.log(point[anchor_field]) / log10) : point[anchor_field]]);
        });

        return [
          [ { label: time_field+' vs '+(use_log?'log ':'')+anchor_field, data: data.times} ], 
          { legend: { position: "nw" }, xaxis: { mode: "time" } },
          y_key
        ];

      }
      else {

        var s_max = results.reduce(function(a,b){ return(a[y_key] > b[y_key]) ? a : b; })[y_key];
        var s_min = results.reduce(function(a,b){ return(a[y_key] <= b[y_key]) ? a : b; })[y_key];
        var use_log = (s_max/s_min > 300);

        var series_dict = {};
        $.each(results, function(idx, point) {
          var y_val = point[y_key];
          if(point[anchor_field] in series_dict)
            series_dict[point[anchor_field]].push(y_val);
          else
            series_dict[point[anchor_field]] = [y_val];
        });

        var data_series = [];
        for (var x_val in series_dict) {
          data_series.push([x_val, series_dict[x_val]]);
        }

        data_series.sort(function(a,b) { return (Number(a[0]) < Number(b[0])) ? -1 : 1; });

        //console.log(data_series);
        $.each(data_series, function(i, point) {

          data.counts.push([i, point[1].length]);
          
          var n = point[0];
          if (n > 3e4)
            n = Number(Number(n).toPrecision(6)).toExponential();
          data.ticks.push([i, n]);

          var mean = point[1].reduce(function(a,b){return a+b;}) / point[1].length;
          var varn = point[1].map(function(a){return a*a;}).reduce(function(a,b){return a+b;}) / point[1].length;
          var max = point[1].reduce(function(a,b){if(a > b) return a; return b;});
          var min = point[1].reduce(function(a,b){if(a <= b) return a; return b;});

          data.mean.push([i, use_log ? (Math.log(mean) / log10) : mean]);
          data.varn.push([i, use_log ? (Math.log(varn) / log10) : varn]);
          data.max.push([i, use_log ? (Math.log(max) / log10) : max]);
          data.min.push([i, use_log ? (Math.log(min) / log10) : min]);
        });

        var chartOptions = {
            legend: { position: "nw" },
            series: { stack: 0,
                      lines: { show: true, steps: false },
                      bars: { show: true, barWidth: 1.0, align: 'center', }, },
            xaxis: { ticks: data.ticks },
        };

        if (y_key == anchor_field){
          return [
            [ { label: anchor_field+' vs count', data: data.counts } ], 
            chartOptions, 
            anchor_field
          ];
        }
        else {
          return [
            [ { label: anchor_field+' vs '+(use_log?'log ':'')+'mean '+y_key, data: data.mean},
              {label: anchor_field+' vs '+(use_log?'log ':'')+'min '+y_key, data: data.min},
              {label: anchor_field+' vs '+(use_log?'log ':'')+'max '+y_key, data: data.max} ],
            chartOptions,
            y_key
          ];
        }

      }
    }

  }


  // routes ///////////////////////////

  App.Router.map(function(match){
    this.resource('documents', { path: "/" }, function() {
      //this.resource('document', { path: ':document_id' });
    });
  });

  
  // application ///////////////////////////

  App.ApplicationRouteInstance = null;

  App.ApplicationRoute = Ember.Route.extend({
    setInstance: function() {
      if (Ember.ENV.DEBUG) console.debug('App.ApplicationRoute.setInstance');
      App.ApplicationRouteInstance = this;
    }.on('init'),

    renderTemplate: function(controller, model) {
      this.render();
    }
  });

  App.ApplicationView = Ember.View.extend({

    // didInsertElement: function() {
    //   if (Ember.ENV.DEBUG) console.debug("App.ApplicationView.didInsertElement");
    // },

    handleKeyUp : function(e){
      // search on input enter
      if(e.which == 13){
        if (Ember.ENV.DEBUG) console.debug('App.ApplicationView.keyUp: enter');
        if(App.DetailsControllerInstance == null || App.DetailsControllerInstance.get('form_disabled'))
          this.get("controller").send("search");
      }
    }
  });

  App.ApplicationControllerInstance = null;

  App.ApplicationController = Ember.Controller.extend({

    // variables
    q : "",

    model_title: "not set",

    // auth: false,
    // org_name: null,
    // username: null,
    // password: null,
    // auth_msg: App.LoggedOutMessage,


    // properties

    // authenticated: function () {
    //   return this.auth;
    // }.property('auth'),

    page_title: function () {
      return this.model_title;
    }.property('model_title'),


    // methods

    setInstance: function() {
      if (Ember.ENV.DEBUG) console.debug('App.ApplicationController.setInstance');
      App.ApplicationControllerInstance = this;
      App.Config.currentModelIndex = 0;
      App.Config.updateModelConfig();
      // App.Authentication.getSession();
    }.on('init'),


    reset : function(){
      if (Ember.ENV.DEBUG) console.debug("App.ApplicationController.reset");
      if(!App.DetailsControllerInstance.close()) return;
      this.set('q', '');
      App.Data.resetSearchParams();
      //this.transitionToRoute('documents');
    },

    search : function(){
      var term = this.get('q');
      if (Ember.ENV.DEBUG) console.debug("App.ApplicationController.search, q: '" + term + "'");
      if(!term) return this.reset();
      App.Data.textQuery = { query_string: { query: term } };
      App.DocumentsControllerInstance.set('currentPage', 1);
    },

    // log_in: function() {
    //   App.Authentication.loginUser();
    // },

    // log_out: function() {
    //   App.Authentication.logOutUser();
    // },

    select_object_type: function(i) {
      if (Ember.ENV.DEBUG) console.debug('App.ApplicationController.select_object_type, i:' + i);
      if(App.DetailsControllerInstance){
        //console.debug(App.DetailsControllerInstance.get('form_enabled'));
        if(!App.DetailsControllerInstance.close()) return;
      }
      App.Config.currentModelIndex = i;
      App.Config.updateModelConfig();
      App.ApplicationRouteInstance.renderTemplate();
      App.DocumentsRouteInstance.renderTemplate();
      App.Data.resetSearchParams();
      //this.transitionToRoute('documents');
    },

    create_object: function() {
      var new_model = {};
      for(var prop in App.Config.getModelConfig().model_base){
        new_model[prop] = null;
      }
      new_model = Ember.Object.create(new_model).reopen({id: 0, version: 0});
      App.DetailsControllerInstance.selectDocument(new_model);
    },

    allow_create: function () {
      //console.log(App.Config.getModelConfig().allow_create);
      return App.Config.getModelConfig().allow_create;
    }.property('model_title'),

  });


  App.DetailsControllerInstance = null;

  App.DetailsController = Ember.ObjectController.extend({

    enable_details: false,

    enable_edit: false,

    reference_model: {},

    show_save_msg: false,
    save_success: false,
    save_msg: null,

    // model: null,

    setInstance: function() {
      if (Ember.ENV.DEBUG) console.debug('App.DetailsController.setInstance');
      App.DetailsControllerInstance = this;
    }.on('init'),

    setReferenceModel: function() {
      var model = this.get('model');
      var reference_model = {};
      for(var prop in App.Config.getModelConfig().model_base){
        var val = model.get(prop);
        if(val == "NULL") {
          val = null;
          model.set(prop, val);
        }
        reference_model[prop] = val;
      }
      this.set('reference_model', reference_model);
    },

    selectDocument: function(doc){
      if (Ember.ENV.DEBUG) console.debug('App.DetailsController.selectDocument');
      if (Ember.ENV.DEBUG) console.debug('App.DetailsController.selectDocument: ', doc);
      var reference_model = this.get('reference_model');
      if(reference_model){
        if(!this.cancel()) return;
      }
      this.set('model', doc);
      this.setReferenceModel();
      //if (Ember.ENV.DEBUG) console.debug('App.DetailsController.selectDocument: ', reference_model);
      
      this.set("enable_details", true);
      this.set('show_save_msg', false);
    },

    close: function(){
      if(!this.cancel()) return false;
      this.set("enable_details", false);
      this.set("model", null);
      this.set("reference_model", {});
      return true;
    },

    edit: function(){
      if (Ember.ENV.DEBUG) console.debug('App.DocumentController.edit');
      //var reference_model = this.get('reference_model');
      //if(reference_model == null) this.set("reference_model", this.get('model')._data.attributes);
      this.set("enable_edit", true);
      this.set('show_save_msg', false);
    },

    cancel: function(){
      if (Ember.ENV.DEBUG) console.debug('App.DocumentController.cancel');
      
      var reference_model = this.get('reference_model');
      if (Ember.ENV.DEBUG) console.debug('App.DocumentController.cancel, reference_model: ', JSON.stringify(reference_model));
      var edited_model = {};
      for(var prop in App.Config.getModelConfig().model_base){
        edited_model[prop] = this.get(prop);
      }
      if (Ember.ENV.DEBUG) console.debug('App.DocumentController.cancel, edited_model: ', JSON.stringify(edited_model));
      if(JSON.stringify(edited_model) != JSON.stringify(reference_model)){
        if(!confirm('DISCARD CHANGES?\n\nThe form has unsaved changes.\n\Click "Cancel" to return to the form.\nClick "OK" to discard your changes.')) 
          return false;
        for(var prop in App.Config.getModelConfig().model_base){
          this.set(prop, reference_model[prop]);
        }
      }
      this.set("enable_edit", false);
      this.set('show_save_msg', false);
      return true;
    },

    save: function(){
      this.set("enable_edit", false);
      var edited_model = {};
      for(var prop in App.Config.getModelConfig().model_base){
        var val = this.get(prop);
        if(val == null || val == "" || val == "NULL"){
          if(App.Config.getModelConfig().model_base[prop] == 'number') val = null;
          else val = "NULL";
        }
        edited_model[prop] = val;
      }
      if (Ember.ENV.DEBUG) {
        console.debug('App.DocumentController.save, reference_model: ', this.get('reference_model'));
        console.debug('App.DocumentController.save, edited_model: ', edited_model);
      }
      $.ajax({
        url : $AJAX_ENDPOINT + "/" + App.Config.getModelConfig().model_name + "/" + "save",
        type: 'POST',
        dataType : "json",
        contentType:"application/json",
        // data: JSON.stringify({
        //   "server_token": App.Authentication.server_token,
        //   "client_token": App.Authentication.client_token,
        //   "username": App.ApplicationControllerInstance.username,
        //   "document": edited_model
        // }),
        data: JSON.stringify(edited_model),
        success:function(json) { 
          if (Ember.ENV.DEBUG) console.debug("App.ApplicationController.save.success", json);
          
          // App.DetailsControllerInstance.set('save_success', json.save_success);
          // App.DetailsControllerInstance.set('save_msg', json.save_msg);
          // App.DetailsControllerInstance.set('show_save_msg', true);

          // if(!json.authenticated) {
          //   App.Authentication.handleBadSession(json);
          // }
          // else if(json.save_success == true){
          //   App.DetailsControllerInstance.setReferenceModel();
          // }

          // if(json.authenticated == true) {
            

          //   App.ApplicationControllerInstance.set('org_name', json.org_name);
          //   App.ApplicationControllerInstance.set('auth', true);
          //   App.Authentication.userHasLoggedIn = true;
          //   App.Data.resetSearchParams();
          // }
          // else {
          //   this.set("enable_edit", false);
          //   App.Authentication.setSessionMessage(json);
          // }
        },
        error: function(err) { console.log("AJAX error: ", err); }
      });
    },

    show_details: function () {
      return this.enable_details;
    }.property('enable_details'),

    form_disabled: function () {
      return !this.enable_edit;
    }.property('enable_edit'),

    form_enabled: function () {
      return this.enable_edit;
    }.property('enable_edit')

  })
  

  // documents ///////////////////////////

  App.DocumentsRouteInstance = null;
  
  App.DocumentsRoute = Ember.Route.extend({
    setInstance: function() {
      if (Ember.ENV.DEBUG) console.debug('App.DocumentsRoute.setInstance');
      App.DocumentsRouteInstance = this;
    }.on('init'),

    renderTemplate: function(controller, model) {
      //this.render();
      this.render('documents' + App.Config.currentModelIndex);
    },
    setupController: function(controller, model) {
      App.Data.resetSearchParams();
    }
  });

  App.DocumentsControllerInstance = null;
  App.FacetsControllerInstance = null;
  App.FacetSelectionsControllerInstance = null;

  // Declare the controller and instantiate the pageable ArrayController, 
  //  with customizations for server-side processing
  App.DocumentsController = Ember.Controller.extend({

    filterBy: function(option){
      if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.filterBy', option);
      App.Faceting.selectOption(option);
    },

    removeFilter: function(option){
      if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.removeFilter', option);
      App.Faceting.removeOption(option);
    },

    getMoreOptions: function(facetName){
      if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.getMoreOptions', facetName);
      App.Faceting.incFacetOptionSize(facetName);
    },

    selectDocument: function(doc) {
      App.DetailsControllerInstance.selectDocument(doc);
    },

    hideDetails: function() {
      App.DetailsControllerInstance.close();
    },

    editDocument: function() {
      App.DetailsControllerInstance.edit();
    },

    cancelEdit: function() {
      App.DetailsControllerInstance.cancel();
    },

    saveChanges: function() {
      App.DetailsControllerInstance.save();
    },

    facetSelections: Ember.ArrayController.createWithMixins(VG.Mixins.Pageable, {

      setInstance: function() {
        if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.facetSelections.setInstance');
        App.FacetSelectionsControllerInstance = this;
      }.on('init'),

      getData: function(){
        this.set('data', App.Faceting.findAllFacetSelections());
      },

      // content: function () {
      //   return this.data;
      // }.property('data')

    }),

    facets: Ember.ArrayController.createWithMixins(VG.Mixins.Pageable, {

      setInstance: function() {
        if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.facets.setInstance');
        App.FacetsControllerInstance = this;
      }.on('init'),

      getData: function(){
        this.set('data', App.Faceting.findAllFacets());
      },

      // content: function () {
      //   return this.data;
      // }.property('data')

    }),

    documents: Ember.ArrayController.createWithMixins(VG.Mixins.Pageable, {

      setInstance: function() {
        if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.documents.setInstance');
        App.DocumentsControllerInstance = this;
      }.on('init'),

      getData: function(){
        App.Data.searchParams.query = App.Data.textQuery;
        if(App.Faceting.enabled) App.Faceting.buildQuerySearchParams();
        //this.set('data', App.Document.find(App.Data.searchParams));
        App.Data.executeSearch();
      },

      perPage: function(key, value) {
        // getter
        if (arguments.length === 1) {
          return App.Data.searchParams.size;

        // setter
        } else {
          if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.documents.perPage; set to: ', value);
          if(value && value != App.Data.searchParams.size && value <= 500){
            App.Data.searchParams.size = value;
            // setting currentPage will trigger a request; no need to update data directly
            this.set('currentPage', 1);
          } 
          return value;
        }
      }.property(),

      totalHitCount: function(key, value) {
        // getter
        if (arguments.length === 1) {
          return App.Data.totalHitCount;

        // setter
        } else {
          if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.documents.totalHitCount; set to: ', value);
          App.Data.totalHitCount = value;
          return value;
        }
      }.property(),

      formatted_totalHitCount: function() {
        return this.get('totalHitCount').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }.property('totalHitCount'),

      // content: function () {
      //   return this.data;
      // }.property('data'),

      totalPages: function () {
        var pages = Math.ceil(this.get('totalHitCount') / this.get('perPage'));
        if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.documents.totalPages: ', pages);
        return pages;
      }.property('totalHitCount', 'perPage'),

      currentPage: function(key, value) {
        // getter
        if (arguments.length === 1) {
          return Math.floor(App.Data.searchParams.from / this.get('perPage')) + 1;

        // setter
        } else {
          if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.documents.currentPage; set to: ', value);
          App.Data.searchParams.from = (value - 1) * this.get('perPage');
          this.getData();
          return value;
        }
      }.property(),

      sortByProperty: function (property, direction) {

        if (Ember.ENV.DEBUG) console.debug('App.DocumentsController.documents.sortByProperty: ', property, direction);

        if (direction === undefined || !direction) {
          if (this.get('sortBy') === property && this.get('sortDirection') === 'ascending') {
            direction = 'descending';
          }
          else {
            direction = 'ascending';
          }
        }

        App.Data.searchParams.sort = {};
        //App.Data.searchParams.sort[property + ".not_analyzed"] = (direction == 'descending') ? "desc" : "asc";
        App.Data.searchParams.sort[property] = (direction == 'descending') ? "desc" : "asc";

        this.set('sortBy', property);
        this.set('sortDirection', direction);
        this.set('currentPage', 1);
      }

    }),

    details: App.DetailsController.create()
  });



  // Declare the pagination view and set the number of pages to show to 10
  App.PaginationView = VG.Views.Pagination.extend({
    numberOfPages: 10
  });

  App.TableHeaderView = VG.Views.TableHeader.extend({
    template: Ember.Handlebars.compile('{{#if view.isCurrent}}<i {{bind-attr class="view.isAscending:icon-chevron-up view.isDescending:icon-chevron-down"}}></i>{{/if}}{{view.text}}')
  });

  // // this allows passing attributes through to the input element
  // App.TextField = Ember.TextField.extend({
  //     attributeBindings: ['name']
  // });

  App.TextField = Ember.TextField.extend({});

  // App.TextField = Ember.TextField.extend({
  //   input_disabled: true
  // });


  // faceting /////////////////////////

  App.Facet = Ember.Object.extend({});

  App.FacetSelection = Ember.Object.extend({});

  App.Faceting = {
    enabled: true,

    facetPageSize: 10,

    facetData: [],
    facetSelections: [],

    findAllFacets: function() {
      ordered = App.Config.getModelConfig().facet_properties.map(function (i){
        for(var j=0; j<App.Faceting.facetData.length; j++){
          if (App.Faceting.facetData[j].name == i){
            return App.Faceting.facetData[j];
          }
        }
      });
      return ordered.map(function (i) {
        return App.Facet.create(i);
      });
    },

    findAllFacetSelections: function() {
      return App.Faceting.facetSelections.map(function (i) {
        return App.FacetSelection.create(i);
      });
    },

    selectOption: function(option){
      var found = false;
      for(var i=0; i < App.Faceting.facetSelections.length; i++){
        if(App.Faceting.facetSelections[i].facet == option.facet){
          App.Faceting.facetSelections[i].term = option.term;
          found = true;
        }
      }
      if(!found) App.Faceting.facetSelections.push({facet: option.facet, facetDisplayName: option.facetDisplayName, term: option.term});
      if (Ember.ENV.DEBUG) 
        console.debug("App.Faceting.selectOption: " + option.facet + ": " + option.term, App.Faceting.facetSelections);
      App.FacetSelectionsControllerInstance.getData();
      App.DocumentsControllerInstance.set('currentPage', 1);
    },

    removeOption: function(option){
      App.Faceting.facetSelections = App.Faceting.facetSelections.filter(function(i){
        return i.facet != option.facet;
      });
      App.Data.searchParams.facets[option.facet] = { "terms" : { "field" : option.facet, size : App.Faceting.facetPageSize } };
      if (Ember.ENV.DEBUG) 
        console.debug("App.Faceting.removeOption: " + option.facet + ": " + option.term, App.Faceting.facetSelections);
      App.FacetSelectionsControllerInstance.getData();
      App.DocumentsControllerInstance.getData();
    },

    incFacetOptionSize: function(facetName){
      App.Data.searchParams.facets[facetName].terms.size += App.Faceting.facetPageSize;
      App.DocumentsControllerInstance.getData();
    },
      
    clearFacetSelections: function(){
      App.Faceting.facetSelections = [];
    },

    buildQuerySearchParams: function() {
      // I used this gist to figure this out: https://gist.github.com/mattweber/1947215
      //console.log(App.Data.searchParams);
      if(App.Faceting.facetSelections.length > 0){
        if(!App.Data.searchParams.query.filtered){
          App.Data.searchParams.query = {
            filtered : {
              query : App.Data.searchParams.query,
              filter : {}
              }
          };
        }
        else {
          App.Data.searchParams.query.filtered.filter = {
            and : [
              App.Data.searchParams.query.filtered.filter
            ]
          };
        }
        if(App.Faceting.facetSelections.length > 1 || App.Data.searchParams.query.filtered.filter.and){
          for(var i=0; i < App.Faceting.facetSelections.length; i++){
            var selection = App.Faceting.facetSelections[i];
            this.addQueryFilterToSearchParams(selection);
            this.addFacetFilterToSearchParams(selection);
          }
        }
        else {
          var selection = App.Faceting.facetSelections[0];

          App.Data.searchParams.query.filtered.filter.terms = {};
          App.Data.searchParams.query.filtered.filter.terms[selection.facet] = [selection.term];

          this.addFacetFilterToSearchParams(selection);
        }
      }
    },

    addQueryFilterToSearchParams: function(selection) {
      if(!App.Data.searchParams.query.filtered.filter.and)
        App.Data.searchParams.query.filtered.filter = { "and": [] };
      var obj = { "terms" : {} };
      obj.terms[selection.facet] = [selection.term];
      App.Data.searchParams.query.filtered.filter.and.push(obj);
    },

    addFacetFilterToSearchParams: function(selection) {
      App.Data.searchParams.facets[selection.facet].facet_filter =  {};
      App.Data.searchParams.facets[selection.facet].facet_filter.terms = {};
      App.Data.searchParams.facets[selection.facet].facet_filter.terms[selection.facet] = [selection.term];
    }
  };


});
//}).call(this);
