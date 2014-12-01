
window.table_config = {

  default_result_size : 200,

  // // App template
    app_template : '\
    <div class="row">\
      <div class="span6" style="width: 600px;">\
        <div class="chart-cont">\
          <div id="chart1stats" class="stats pull-right">*</div>\
          <div id="chart1" class="chart"></div>\
          <div class="marker" style="display:none;"></div>\
          <div style="clear:both;"></div>\
        </div>\
      </div>\
      <div class="span6" style="width: 600px;">\
        <div class="chart-cont">\
          <div id="chart2stats" class="stats pull-right">*</div>\
          <div id="chart2" class="chart"></div>\
          <div class="marker" style="display:none;"></div>\
          <div style="clear:both;"></div>\
        </div>\
      </div>\
    </div>\
    <div class="row">\
      <div class="span12 search-actions">\
        <div class="pull-left">\
          <button {{action "reset"}} class="btn">Reset Search</button>\
        </div>\
        {{#if allow_create }}\
        <div class="pull-left">\
          <div class="span3">\
            <button {{action "create_object"}} class="btn">Create New Object</button>\
          </div>\
        </div>\
        {{/if}}\
      </div>\
    </div>\
    {{outlet}}\
  ',

  model_config_list: [

    {
      model_name: "matrix-mult-stats/result",
      model_title: "Matrix Mult Results",

      use_fields: false,

      allow_create: false,

      default_sort_property: "time",
      default_sort_direction: "descending",

      facet_properties: ['n', 'g', 'dnn_gg'],

      anchor_field: 'n',
      time_field: 'time',

      model_base: [
        ['n', "number"],
        ['d', "number"],
        ['g', "number"],
        ['nn', "number"],
        // ['gg', "number"],
        ['dnn', "number"],
        ['dnn_gg', "number"],
        ['grp_cnt_avg', "number"],
        // ['a_den', "number"],
        // ['b_den', "number"],
        ['rel_den', "number"],
        ['c_den', "number"],
        ['a_ct', "number"],
        ['b_ct', "number"],
        ['c_ct', "number"],
        // ['a_norm', "number"],
        // ['b_norm', "number"],
        ['ab_norm', "number"],
        ['c_norm', "number"],
        ['elap_sec', "number"],
        ['time', "number"],
      ],


      //  analytics_circleleader_incomes table template
      table_template : '\
<div class="row">\
  <div class="span3 results-count">\
    <h4> <span class="text-warning">{{documents.formatted_totalHitCount}} </span><strong>results</strong></h4>\
  </div>\
  <div class="span2 per-page-input">\
    {{view App.TextField valueBinding="documents.perPage" placeholder="per page"}}\ <strong>per page</strong>\
  </div>\
  {{view App.PaginationView controllerBinding="documents" classNames="span7"}}\
</div>\
<div class="row">\
  <div class="span2">\
    <table class="table table-bordered table-condensed">\
      <tr><th>Filter By</th></tr>\
      <tr><td>\
        <ul class="unstyled">\
          {{#each selection in facetSelections}}\
            <li>\
              <a {{action "removeFilter" selection}} title="click to remove" ><em>{{selection.facetDisplayName}}:</em> {{selection.term}}</a>\
            </li>\
          {{/each}}\
        </ul>\
      </td></tr>\
      <tr><td>\
        <ul class="facets unstyled">\
          {{#each facet in facets}}\
            <li>\
              <strong>{{facet.displayName}}</strong>\
              <ul class="facet-options unstyled">\
                {{#each option in facet.terms}}\
                  <li><a {{action "filterBy" option}} >{{option.term}}</a> ({{option.count}})</li>\
                {{/each}}\
                {{#if facet.hasMore}}\
                  <li><a {{action "getMoreOptions" facet.name}} >more...</a></li>\
                {{/if}}\
              </ul>\
            </li>\
          {{/each}}\
        </ul>\
      </td></tr>\
    </table>\
  </div>\
  <div class="span10">\
    <table class="table table-striped table-bordered table-condensed">\
      <thead>\
        <tr>\
        ' 
    }
  ]
};


for(var i=0; i < table_config.model_config_list.length; i++){
  var item = table_config.model_config_list[i];
  for(var j=0; j < item.model_base.length; j++){
    var prop = item.model_base[j][0];
    item.table_template += 
      '{{view App.TableHeaderView text="'+prop+'" propertyName="'+prop+'" controllerBinding="documents"}}'
  }
  item.table_template += '\
        </tr>\
      </thead>\
      <tbody>\
        {{#each doc in documents}}\
          <tr>\
          '
  for(var j=0; j < item.model_base.length; j++){
    var prop = item.model_base[j][0];
    item.table_template += 
      '<td>{{doc.'+prop+'}}</td>'
  }
  item.table_template += '\
        </tr>\
        {{/each}}\
      </tbody>\
    </table>\
  </div>\
</div>\
<div class="row">\
  {{view App.PaginationView controllerBinding="documents" classNames="span12"}}\
</div>\
      '
}
 