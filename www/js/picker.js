(function($){

  $(function() {
    App.init();
  });

  var App = {

    indexTicker: "SPY",

    startingTicker: "AMZN",

    requestInProgress: false,

    dataLength: 0,

    searchResults: [],

    chartPlotObjList: [],

    dataSeriesDict: {},

    chartDataList: [],

    recommendationResults: [],

    chartOptions: { 
      legend: { position: "nw" }, 
      selection: { mode: "x" },
      xaxis: { mode: "time" },
      grid:  {show: true, margin: 0, borderWidth: 0, margin: 0, 
                labelMargin: 0, axisMargin: 0, minBorderMargin: 0, 
                hoverable: true, autoHighlight: false}
    },

    init: function() {
      var self = this;

      self.getTickerData(self.startingTicker, self.indexTicker);

      self.getTickerList();

      self.getRecommendations();

      $("body").click(function(e) {
        // console.log(self.requestInProgress);
        if (!self.requestInProgress) {
          var ticker = $(e.target).attr("data-ticker");
          if (ticker) {
            self.requestInProgress = true;
            // console.debug(ticker + " clicked");
            self.clearMessages();
            self.getTickerData(ticker, self.indexTicker);
            return false;
          }
          var filter = $(e.target).attr("data-filter");
          if (filter) {
            if (filter == "none")
              self.displayRecommendations(self.recommendationResults, null);
            else
              self.displayRecommendations(self.recommendationResults, filter);
            return false;
          }
        }
        return true;
      });

      $("#add_ticker_form").submit(function() {
        var ticker = $("#add_ticker_text").val().toUpperCase();
        // console.debug("add: " + ticker);
        if (ticker && !self.requestInProgress) {
          self.clearMessages();
          self.addNewTicker(ticker);
        }
        return false;
      });

      $(".unzoom").click(function() {
          // console.debug("Unzoom click");
          self.clearMessages();
          self.plotCharts(self.chartOptions);
      });

      $(".chart").on("plotselected", function(ev, ranges) {
        // console.debug("plotselected");
        self.plotCharts($.extend(true, {}, self.chartOptions, 
          { xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to } }
        ));
      });

      $(".chart").on("plothover", function(ev, pos) {

        //if (ev.currentTarget) console.debug(ev.currentTarget, pos.pageX);

        var left = self.chartPlotObjList[0].pointOffset(pos).left;

        if (left >= 0 && left <= $(".chart").width()) {
          $(".marker").css({'left':left}).show();
          
          var date = new Date(pos.x);
          var date_string = [date.getFullYear(),date.getMonth(),date.getDate()].join('-');
          
          var i = self.searchResults.length - 1;
          while (i > 0 && self.searchResults[i].date > date) i--;

          self.updateChartStats(self.searchResults[i]);
        }
      });

      $(".chart").on("mouseout", function(ev) {
        if (!ev.relatedTarget || ev.relatedTarget.id !== "marker") {
          $(".marker").hide();
        }
      });

      $(".marker").on("mouseout", function(ev) {
        $(".marker").hide();
      });

      $(".marker").on("mousedown", function(ev, pos) {
        $(".marker").hide();
        return false;
      });

    },

    clearMessages: function() {
      $("#error_message").hide();
      $("#success_message").hide();
      $(".chart").html("");
      $(".stats").html("*");
    },

    executeTickerDataRequest: function(ticker, index) {
      return $.ajax({
        url : $AJAX_ENDPOINT + "/tickerdata",
        type: 'POST',
        contentType:"application/json",
        dataType : "json",
        data: JSON.stringify({
          "es_request": {
            "from": 0,
            "size": 1000,
            "query": { "match_all" : {} },
            "sort": [ { "date": { "order": "asc" } } ]
          },
          "ticker": ticker,
          "index": index
        })
      });
    },

    addNewTicker: function(ticker) {
      var self = this;

      self.requestInProgress = true;

      $(".chart").html("");
      $(".stats").html("*");
      $("#success_message").html("Adding '" + ticker + "', please wait...");
      $("#success_message").show();

      var deferredRequest = $.ajax({
        url : $AJAX_ENDPOINT + "/addticker",
        type: 'POST',
        contentType:"application/json",
        dataType : "json",
        data: JSON.stringify({ "ticker": ticker })
      });

      deferredRequest.done(function(json) {
        self.requestInProgress = false;
        // console.debug(json);
        if (json.success){
          $("#error_message").html("");
          $("#error_message").hide();
          $("#success_message").html("Added '" + ticker + "'");
          $("#success_message").show();
          $("#add_ticker_text").val('');
          self.getTickerList();
          self.getTickerData(ticker, self.indexTicker);
        }
        else {
          // console.debug(json.msg);
          $("#success_message").html("");
          $("#success_message").hide();
          $("#error_message").html(json.msg);
          $("#error_message").show();
        }
      });
    },

    formatRecommendation: function(obj) {
      return '<tr>' +
        '<td>' +
        '<a href="#" data-ticker="' + obj['sym'] + '">' + obj['sym'] + '</a>' +
        ' [<a target="_blank" href="https://www.google.com/finance?q=' + obj['sym'] + '">gf</a>]</td>' +
        '<td>' + obj['ac']  + '</td>' +
        '<td>' + obj['sac']  + '</td>' +
        '<td>' + obj['sac_ma']  + '</td>' +
        '<td>' + obj['ratio']  + '</td>' +
        '</tr>'
    },

    displayRecommendations: function(json, startingLetter) {
      var self = this;

      $("#latest_date").html(json['latest_data_date']);
      
      var sell_count = 0;
      $("#sell_table").html("");
      for(var i = 0; i < json['sell_hits'].length; i++){
        var hit = json['sell_hits'][i];
        if(startingLetter == null || startingLetter == hit['sym'][0]){
          $("#sell_table").append(self.formatRecommendation(hit));
          sell_count += 1;
        }
      }
      $("#sell_count").html(sell_count);

      var buy_count = 0;
      $("#buy_table").html("");
      for(var i = 0; i < json['buy_hits'].length; i++){
        var hit = json['buy_hits'][i];
        if(startingLetter == null || startingLetter == hit['sym'][0]){
          $("#buy_table").append(self.formatRecommendation(hit));
          buy_count += 1;
        }
      }
      $("#buy_count").html(buy_count);
    },

    getRecommendations: function() {
      var self = this;
      
      self.requestInProgress = true;

      var deferredRequest = $.getJSON($AJAX_ENDPOINT + "/recommendations");
      
      deferredRequest.done(function(json) {
        self.requestInProgress = false;
        // console.debug(json);
        self.recommendationResults = json;

        self.displayRecommendations(json, null);

        var startingLetters = {};

        for(var i = 0; i < json['sell_hits'].length; i++){
          var hit = json['sell_hits'][i];
          startingLetters[hit['sym'][0]] = null;
        }
        for(var i = 0; i < json['buy_hits'].length; i++){
          var hit = json['buy_hits'][i];
          startingLetters[hit['sym'][0]] = null;
        }

        //console.log(startingLetters);
        var lettersArray = [];
        for(var prop in startingLetters) lettersArray.push(prop);
        lettersArray.sort();
        //console.log(lettersArray);
        $("#filter_rec").append('<a href="#" data-filter="none">none</a>&nbsp;&nbsp;&nbsp;');
        for(var i=0; i<lettersArray.length; i++){
          $("#filter_rec").append('<a href="#" data-filter="' + lettersArray[i] + '">' + lettersArray[i] + '</a>&nbsp;&nbsp;');
        }
      })
    },

    getTickerList: function() {
      var self = this;
      
      self.requestInProgress = true;

      var deferredRequest = $.getJSON($AJAX_ENDPOINT + "/tickerlist");
      
      deferredRequest.done(function(json) {
        self.requestInProgress = false;
        // console.debug(json);
        $("#tickerlist").html('');
        var startsWith = json.tickers[0][0];
        $.each(json.tickers, function(idx, ticker) {
          if (ticker[0] != startsWith) {
            startsWith = ticker[0];
            $("#tickerlist").append('<li>&nbsp;</li>');
          }
          $("#tickerlist").append('<li><a href="#" data-ticker="' + ticker + '">' + ticker + '</a></li>');
        })
      })
    },

    colors: [
      "#E41A1C",
      "#377EB8",
      "#4DAF4A",
      "#984EA3",
      "#000000",
      "#FF7F00",
      "#FFFF33",
    ],


    getTickerData: function(ticker, index) {
      var self = this;

      var deferredRequest = this.executeTickerDataRequest(ticker, index);

      deferredRequest.done(function(json) {
        // console.debug(json);

        self.dataLength = json.results.length;

        self.searchResults = json.results;

        self.dataSeriesDict = { date: [], zeros: [] };
        for (var prop in json.results[0]) {
          if (prop) {
            self.dataSeriesDict[prop] = [];
          }
        }

        $.each(json.results, function(idx, point) {
          //console.log(point);
          point.date = Date.parse(point.d);
          self.dataSeriesDict.zeros.push([ point.date, 0 ]);
          for (var prop in point) {
            if (prop) {
              self.dataSeriesDict[prop].push([ point.date, point[prop] ]);
            }
          }
        });

        // console.log(self.dataSeriesDict);

        // plot adjusted close prices for ticker and index
        self.chartDataList = [
          [ { name: "ac", label: json.ticker, data: self.dataSeriesDict["ac"] },
            { name: "iac", label: json.index, data: self.dataSeriesDict["iac"] } ],

          [ { name: "sac", label: 'Scaled Adj Close', data: self.dataSeriesDict['sac'] },
            { name: "sac_ma", label: json.avg_weeks + '-wk SAC Mv Avg', data: self.dataSeriesDict['sac_ma'] } ],

          // [ { name: "d_sacma", label: 'Grad SACMA', data: self.dataSeriesDict['d_sacma'] },
          //   //{ name: "d_sacma_dt", label: 'd_sacma_dt', data: self.dataSeriesDict['d_sacma_dt'] },
          //   { name: "", label: '0', data: self.dataSeriesDict['zeros'] } ],

          // [ { name: "ac_cr", label: 'AC CC Ret', data: self.dataSeriesDict['ac_cr'] },
          //   { name: "", label: '0', data: self.dataSeriesDict['zeros'] } ]
        ];

        self.plotCharts(self.chartOptions);

        self.requestInProgress = false;

      })
    },

    plotCharts: function(chartOptions) {
      var self = this;

      self.chartPlotObjList = [];
      for (var i = 0; i < self.chartDataList.length; i++){
        var series = self.chartDataList[i];
        self.chartPlotObjList.push($.plot($("#chart"+(i+1)), series, chartOptions));
      }

      var point = self.searchResults[self.searchResults.length-1];

      self.updateChartStats(point);
    },

    updateChartStats: function(point) {
      var self = this;

      for (var i = 0; i < self.chartDataList.length; i++){
        var series = self.chartDataList[i];
        var dataList = [point.d];
        for (var j = 0; j < series.length; j++){
          dataList.push(series[j].name+":");
          dataList.push(point[series[j].name]);
        }
        $("#chart"+(i+1)+"stats").html(dataList.join(' '));
      }
    }

  };

})(jQuery);