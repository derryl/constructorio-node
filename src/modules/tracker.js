/* eslint-disable camelcase, no-underscore-dangle, no-unneeded-ternary, brace-style */
const qs = require('qs');
const nodeFetch = require('node-fetch').default;
const { AbortController } = require('node-abort-controller');
const EventEmitter = require('events');
const helpers = require('../utils/helpers');

function applyParams(parameters, userParameters, options) {
  const {
    apiKey,
    version,
  } = options;
  const {
    sessionId,
    clientId,
    userId,
    segments,
    testCells,
    originReferrer,
  } = userParameters || {};
  let aggregateParams = Object.assign(parameters);

  // Validate session ID is provided
  if (!sessionId || typeof sessionId !== 'number') {
    throw new Error('sessionId is a required user parameter of type number');
  }

  // Validate client ID is provided
  if (!clientId || typeof clientId !== 'string') {
    throw new Error('clientId is a required user parameter of type string');
  }

  if (version) {
    aggregateParams.c = version;
  }

  if (clientId) {
    aggregateParams.i = clientId;
  }

  if (sessionId) {
    aggregateParams.s = sessionId;
  }

  if (userId) {
    aggregateParams.ui = userId;
  }

  if (segments && segments.length) {
    aggregateParams.us = segments;
  }

  if (apiKey) {
    aggregateParams.key = apiKey;
  }

  if (testCells) {
    Object.keys(testCells).forEach((testCellKey) => {
      aggregateParams[`ef-${testCellKey}`] = testCells[testCellKey];
    });
  }

  if (originReferrer) {
    aggregateParams.origin_referrer = originReferrer;
  }

  aggregateParams._dt = Date.now();
  aggregateParams.beacon = true;
  aggregateParams = helpers.cleanParams(aggregateParams);

  return aggregateParams;
}

// Append common parameters to supplied parameters object and return as string
function applyParamsAsString(parameters, userParameters, options) {
  return qs.stringify(applyParams(parameters, userParameters, options), { indices: false });
}

// Send request to server
function send(url, userParameters, networkParameters, method = 'GET', body = {}) { // eslint-disable-line max-params
  let request;
  const fetch = (this.options && this.options.fetch) || nodeFetch;
  const controller = new AbortController();
  const { signal } = controller;
  const headers = {};

  // Append security token as 'x-cnstrc-token' if available
  if (this.options.securityToken && typeof this.options.securityToken === 'string') {
    headers['x-cnstrc-token'] = this.options.securityToken;
  }

  if (userParameters) {
    // Append user IP as 'X-Forwarded-For' if available
    if (userParameters.userIp && typeof userParameters.userIp === 'string') {
      headers['X-Forwarded-For'] = userParameters.userIp;
    }

    // Append user agent as 'User-Agent' if available
    if (userParameters.userAgent && typeof userParameters.userAgent === 'string') {
      headers['User-Agent'] = userParameters.userAgent;
    }

    // Append language as 'Accept-Language' if available
    if (userParameters.acceptLanguage && typeof userParameters.acceptLanguage === 'string') {
      headers['Accept-Language'] = userParameters.acceptLanguage;
    }

    // Append referrer as 'Referer' if available
    if (userParameters.referer && typeof userParameters.referer === 'string') {
      headers.Referer = userParameters.referer;
    }
  }

  // Handle network timeout if specified
  helpers.applyNetworkTimeout(this.options, networkParameters, controller);

  if (method === 'GET') {
    request = fetch(url, { headers, signal });
  }

  if (method === 'POST') {
    request = fetch(url, {
      method,
      body: JSON.stringify(body),
      mode: 'cors',
      headers: {
        ...headers,
        'Content-Type': 'text/plain',
      },
      signal,
    });
  }

  if (request) {
    const instance = this;

    request.then((response) => {
      // Request was successful, and returned a 2XX status code
      if (response.ok) {
        instance.eventemitter.emit('success', {
          url,
          method,
          message: 'ok',
        });
      }

      // Request was successful, but returned a non-2XX status code
      else {
        response.json().then((json) => {
          instance.eventemitter.emit('error', {
            url,
            method,
            message: json && json.message,
          });
        }).catch((error) => {
          instance.eventemitter.emit('error', {
            url,
            method,
            message: error.type,
          });
        });
      }
    }).catch((error) => {
      instance.eventemitter.emit('error', {
        url,
        method,
        message: error.toString(),
      });
    });
  }
}

/**
 * Interface to tracking related API calls
 *
 * @module tracker
 * @inner
 * @returns {object}
 */
class Tracker {
  constructor(options) {
    this.options = options || {};
    this.eventemitter = new EventEmitter();
  }

  /**
   * Send session start event to API
   *
   * @function trackSessionStart
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @example
   * constructorio.tracker.trackSessionStart({
   *  sessionId: 1,
   *  clientId: '6c73138f-c27b-49f0-872d-63b00ed0e395',
   *  testCells: { testName: 'cellName' },
   * });
   */
  trackSessionStart(userParameters, networkParameters = {}) {
    const url = `${this.options.serviceUrl}/behavior?`;
    const queryParams = { action: 'session_start' };
    const requestUrl = `${url}${applyParamsAsString(queryParams, userParameters, this.options)}`;

    send.call(
      this,
      requestUrl,
      userParameters,
      networkParameters,
    );

    return true;
  }

  /**
   * Send input focus event to API
   *
   * @function trackInputFocus
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User focused on search input element
   * @example
   * constructorio.tracker.trackInputFocus({
   *     sessionId: 1,
   *     clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *     testCells: { testName: 'cellName' },
   * });
   */
  trackInputFocus(userParameters, networkParameters = {}) {
    const url = `${this.options.serviceUrl}/behavior?`;
    const queryParams = { action: 'focus' };
    const requestUrl = `${url}${applyParamsAsString(queryParams, userParameters, this.options)}`;

    send.call(
      this,
      requestUrl,
      userParameters,
      networkParameters,
    );

    return true;
  }

  /**
   * Send item detail load event to API
   *
   * @function trackItemDetailLoad
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.item_name - Product item name
   * @param {string} parameters.item_id - Product item unique identifier
   * @param {string} [parameters.variation_id] - Product item variation unique identifier
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User loaded an item detail page
   * @example
   * constructorio.tracker.trackItemDetailLoad(
   *     {
   *         item_name: 'Red T-Shirt',
   *         item_id: 'KMH876',
   *     },
   * );
   */
  trackItemDetailLoad(parameters, userParameters, networkParameters = {}) {
    // Ensure parameters are provided (required)
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const url = `${this.options.serviceUrl}/behavior?`;
      const queryParams = { action: 'item_detail_load' };
      const { item_name, name, item_id, customer_id, variation_id } = parameters;

      // Ensure support for both item_name and name as parameters
      if (item_name) {
        queryParams.name = item_name;
      } else if (name) {
        queryParams.name = name;
      }

      // Ensure support for both item_id and customer_id as parameters
      if (item_id) {
        queryParams.customer_id = item_id;
      } else if (customer_id) {
        queryParams.customer_id = customer_id;
      }

      if (variation_id) {
        queryParams.variation_id = variation_id;
      }

      const requestUrl = `${url}${applyParamsAsString(queryParams, userParameters, this.options)}`;

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
      );

      return true;
    }

    return new Error('parameters are required of type object');
  }

  /**
   * Send autocomplete select event to API
   *
   * @function trackAutocompleteSelect
   * @param {string} term - Term of selected autocomplete item
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.original_query - The current autocomplete search query
   * @param {string} parameters.section - Section the selected item resides within
   * @param {string} [parameters.tr] - Trigger used to select the item (click, etc.)
   * @param {string} [parameters.group_id] - Group identifier of selected item
   * @param {string} [parameters.display_name] - Display name of group of selected item
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User selected (clicked, or navigated to via keyboard) a result that appeared within autocomplete
   * @example
   * constructorio.tracker.trackAutocompleteSelect(
   *     'T-Shirt',
   *     {
   *         original_query: 'Shirt',
   *         section: 'Products',
   *         tr: 'click',
   *         group_id: '88JU230',
   *         display_name: 'apparel',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackAutocompleteSelect(term, parameters, userParameters, networkParameters = {}) {
    // Ensure term is provided (required)
    if (term && typeof term === 'string') {
      // Ensure parameters are provided (required)
      if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
        const url = `${this.options.serviceUrl}/autocomplete/${helpers.encodeURIComponentRFC3986(helpers.trimNonBreakingSpaces(term))}/select?`;
        const queryParams = {};
        const {
          original_query,
          section,
          original_section,
          tr,
          group_id,
          display_name,
        } = parameters;

        if (original_query) {
          queryParams.original_query = original_query;
        }

        if (tr) {
          queryParams.tr = tr;
        }

        if (original_section || section) {
          queryParams.section = original_section || section;
        }

        if (group_id) {
          queryParams.group = {
            group_id,
            display_name,
          };
        }

        const requestUrl = `${url}${applyParamsAsString(queryParams, userParameters, this.options)}`;

        send.call(
          this,
          requestUrl,
          userParameters,
          networkParameters,
        );

        return true;
      }

      return new Error('parameters are required of type object');
    }

    return new Error('term is a required parameter of type string');
  }

  /**
   * Send autocomplete search event to API
   *
   * @function trackSearchSubmit
   * @param {string} term - Term of submitted autocomplete event
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.original_query - The current autocomplete search query
   * @param {string} [parameters.group_id] - Group identifier of selected item
   * @param {string} [parameters.display_name] - Display name of group of selected item
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User submitted a search (pressing enter within input element, or clicking submit element)
   * @example
   * constructorio.tracker.trackSearchSubmit(
   *     'T-Shirt',
   *     {
   *         original_query: 'Shirt',
   *         group_id: '88JU230',
   *         display_name: 'apparel',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackSearchSubmit(term, parameters, userParameters, networkParameters = {}) {
    // Ensure term is provided (required)
    if (term && typeof term === 'string') {
      // Ensure parameters are provided (required)
      if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
        const url = `${this.options.serviceUrl}/autocomplete/${helpers.encodeURIComponentRFC3986(helpers.trimNonBreakingSpaces(term))}/search?`;
        const queryParams = {};
        const { original_query, group_id, display_name } = parameters;

        if (original_query) {
          queryParams.original_query = original_query;
        }

        if (group_id) {
          queryParams.group = {
            group_id,
            display_name,
          };
        }

        const requestUrl = `${url}${applyParamsAsString(queryParams, userParameters, this.options)}`;

        send.call(
          this,
          requestUrl,
          userParameters,
          networkParameters,
        );

        return true;
      }

      return new Error('parameters are required of type object');
    }

    return new Error('term is a required parameter of type string');
  }

  /**
   * Send search results event to API
   *
   * @function trackSearchResultsLoaded
   * @param {string} term - Search results query term
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {number} parameters.num_results - Total number of results
   * @param {string[]} [parameters.item_ids] - List of product item unique identifiers in search results listing
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User loaded a search product listing page
   * @example
   * constructorio.tracker.trackSearchResultsLoaded(
   *     'T-Shirt',
   *     {
   *         num_results: 167,
   *         item_ids: ['KMH876', 'KMH140', 'KMH437'],
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackSearchResultsLoaded(term, parameters, userParameters, networkParameters = {}) {
    // Ensure term is provided (required)
    if (term && typeof term === 'string') {
      // Ensure parameters are provided (required)
      if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
        const url = `${this.options.serviceUrl}/behavior?`;
        const queryParams = { action: 'search-results', term };
        const { num_results, customer_ids, item_ids } = parameters;
        let customerIDs;

        if (!helpers.isNil(num_results)) {
          queryParams.num_results = num_results;
        }

        // Ensure support for both item_ids and customer_ids as parameters
        if (item_ids && Array.isArray(item_ids)) {
          customerIDs = item_ids;
        } else if (customer_ids && Array.isArray(customer_ids)) {
          customerIDs = customer_ids;
        }

        if (customerIDs && Array.isArray(customerIDs) && customerIDs.length) {
          queryParams.customer_ids = customerIDs.slice(0, 100).join(',');
        }

        const requestUrl = `${url}${applyParamsAsString(queryParams, userParameters, this.options)}`;

        send.call(
          this,
          requestUrl,
          userParameters,
          networkParameters,
        );

        return true;
      }

      return new Error('parameters are required of type object');
    }

    return new Error('term is a required parameter of type string');
  }

  /**
   * Send click through event to API
   *
   * @function trackSearchResultClick
   * @param {string} term - Search results query term
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.item_name - Product item name
   * @param {string} parameters.item_id - Product item unique identifier
   * @param {string} [parameters.variation_id] - Product item variation unique identifier
   * @param {string} [parameters.result_id] - Search result identifier (returned in response from Constructor)
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User clicked a result that appeared within a search product listing page
   * @example
   * constructorio.tracker.trackSearchResultClick(
   *     'T-Shirt',
   *     {
   *         item_name: 'Red T-Shirt',
   *         item_id: 'KMH876',
   *         result_id: '019927c2-f955-4020-8b8d-6b21b93cb5a2',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackSearchResultClick(term, parameters, userParameters, networkParameters = {}) {
    // Ensure term is provided (required)
    if (term && typeof term === 'string') {
      // Ensure parameters are provided (required)
      if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
        const url = `${this.options.serviceUrl}/autocomplete/${helpers.encodeURIComponentRFC3986(helpers.trimNonBreakingSpaces(term))}/click_through?`;
        const queryParams = {};
        const { item_name, name, item_id, customer_id, variation_id, result_id } = parameters;

        // Ensure support for both item_name and name as parameters
        if (item_name) {
          queryParams.name = item_name;
        } else if (name) {
          queryParams.name = name;
        }

        // Ensure support for both item_id and customer_id as parameters
        if (item_id) {
          queryParams.customer_id = item_id;
        } else if (customer_id) {
          queryParams.customer_id = customer_id;
        }

        if (variation_id) {
          queryParams.variation_id = variation_id;
        }

        if (result_id) {
          queryParams.result_id = result_id;
        }

        const requestUrl = `${url}${applyParamsAsString(queryParams, userParameters, this.options)}`;

        send.call(
          this,
          requestUrl,
          userParameters,
          networkParameters,
        );

        return true;
      }

      return new Error('parameters are required of type object');
    }

    return new Error('term is a required parameter of type string');
  }

  /**
   * Send conversion event to API
   *
   * @function trackConversion
   * @param {string} [term] - Search results query term that led to conversion event
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.item_id - Product item unique identifier
   * @param {number} [parameters.revenue] - Sale price if available, otherwise the regular (retail) price of item
   * @param {string} [parameters.item_name] - Product item name
   * @param {string} [parameters.variation_id] - Product item variation unique identifier
   * @param {string} [parameters.type='add_to_cart'] - Conversion type
   * @param {boolean} [parameters.is_custom_type] - Specify if type is custom conversion type
   * @param {string} [parameters.display_name] - Display name for the custom conversion type
   * @param {string} [parameters.result_id] - Result identifier (returned in response from Constructor)
   * @param {string} [parameters.section] - Index section
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User performed an action indicating interest in an item (add to cart, add to wishlist, etc.)
   * @see https://docs.constructor.io/rest_api/behavioral_logging/conversions
   * @example
   * constructorio.tracker.trackConversion(
   *     'T-Shirt',
   *     {
   *         item_id: 'KMH876',
   *         revenue: 12.00,
   *         item_name: 'Red T-Shirt',
   *         variation_id: 'KMH879-7632',
   *         type: 'like',
   *         result_id: '019927c2-f955-4020-8b8d-6b21b93cb5a2',
   *         section: 'Products',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackConversion(term, parameters, userParameters, networkParameters = {}) {
    // Ensure parameters are provided (required)
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const searchTerm = term || 'TERM_UNKNOWN';
      const requestPath = `${this.options.serviceUrl}/v2/behavioral_action/conversion?`;
      const queryParams = {};
      const bodyParams = {};
      const {
        name,
        item_name,
        item_id,
        customer_id,
        variation_id,
        revenue,
        section = 'Products',
        display_name,
        type,
        is_custom_type,
      } = parameters;

      // Ensure support for both item_id and customer_id as parameters
      if (item_id) {
        bodyParams.item_id = item_id;
      } else if (customer_id) {
        bodyParams.item_id = customer_id;
      }

      // Ensure support for both item_name and name as parameters
      if (item_name) {
        bodyParams.item_name = item_name;
      } else if (name) {
        bodyParams.item_name = name;
      }

      if (variation_id) {
        bodyParams.variation_id = variation_id;
      }

      if (revenue) {
        bodyParams.revenue = revenue.toString();
      }

      if (section) {
        queryParams.section = section;
        bodyParams.section = section;
      }

      if (searchTerm) {
        bodyParams.search_term = searchTerm;
      }

      if (type) {
        bodyParams.type = type;
      }

      if (is_custom_type) {
        bodyParams.is_custom_type = is_custom_type;
      }

      if (display_name) {
        bodyParams.display_name = display_name;
      }

      const requestUrl = `${requestPath}${applyParamsAsString(queryParams, userParameters, this.options)}`;
      const requestMethod = 'POST';
      const requestBody = applyParams(bodyParams, userParameters, { ...this.options, requestMethod });

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
        requestMethod,
        requestBody,
      );

      return true;
    }

    return new Error('parameters are required of type object');
  }

  /**
   * Send purchase event to API
   *
   * @function trackPurchase
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {object[]} parameters.items - List of product item objects
   * @param {number} parameters.revenue - The subtotal (excluding taxes, shipping, etc.) of the entire order
   * @param {string} [parameters.order_id] - Unique order identifier
   * @param {string} [parameters.section] - Index section
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User completed an order (usually fired on order confirmation page)
   * @example
   * constructorio.tracker.trackPurchase(
   *     {
   *         items: [{ item_id: 'KMH876' }, { item_id: 'KMH140' }],
   *         revenue: 12.00,
   *         order_id: 'OUNXBG2HMA',
   *         section: 'Products',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackPurchase(parameters, userParameters, networkParameters = {}) {
    // Ensure parameters are provided (required)
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const requestPath = `${this.options.serviceUrl}/v2/behavioral_action/purchase?`;
      const queryParams = {};
      const bodyParams = {};
      const { items, revenue, order_id, section } = parameters;

      if (order_id) {
        bodyParams.order_id = order_id;
      }

      if (items && Array.isArray(items)) {
        bodyParams.items = items.slice(0, 100);
      }

      if (revenue) {
        bodyParams.revenue = revenue;
      }

      if (section) {
        queryParams.section = section;
      } else {
        queryParams.section = 'Products';
      }

      const requestUrl = `${requestPath}${applyParamsAsString(queryParams, userParameters, this.options)}`;
      const requestMethod = 'POST';
      const requestBody = applyParams(bodyParams, userParameters, { ...this.options, requestMethod });

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
        requestMethod,
        requestBody,
      );

      return true;
    }

    return new Error('parameters are required of type object');
  }

  /**
   * Send recommendation view event to API
   *
   * @function trackRecommendationView
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.url - Current page URL
   * @param {string} parameters.pod_id - Pod identifier
   * @param {number} parameters.num_results_viewed - Number of results viewed
   * @param {number} [parameters.result_count] - Total number of results
   * @param {number} [parameters.result_page] - Page number of results
   * @param {string} [parameters.result_id] - Recommendation result identifier (returned in response from Constructor)
   * @param {string} [parameters.section="Products"] - Results section
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User clicked a result that appeared within a search product listing page
   * @example
   * constructorio.tracker.trackRecommendationView(
   *     {
   *         result_count: 22,
   *         result_page: 2,
   *         result_id: '019927c2-f955-4020-8b8d-6b21b93cb5a2',
   *         url: 'https://demo.constructor.io/sandbox/farmstand',
   *         pod_id: '019927c2-f955-4020',
   *         num_results_viewed: 3,
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackRecommendationView(parameters, userParameters, networkParameters = {}) {
    // Ensure parameters are provided (required)
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const requestPath = `${this.options.serviceUrl}/v2/behavioral_action/recommendation_result_view?`;
      const bodyParams = {};
      const {
        result_count,
        result_page,
        result_id,
        section,
        url,
        pod_id,
        num_results_viewed,
      } = parameters;

      if (!helpers.isNil(result_count)) {
        bodyParams.result_count = result_count;
      }

      if (!helpers.isNil(result_page)) {
        bodyParams.result_page = result_page;
      }

      if (result_id) {
        bodyParams.result_id = result_id;
      }

      if (section) {
        bodyParams.section = section;
      } else {
        bodyParams.section = 'Products';
      }

      if (url) {
        bodyParams.url = url;
      }

      if (pod_id) {
        bodyParams.pod_id = pod_id;
      }

      if (!helpers.isNil(num_results_viewed)) {
        bodyParams.num_results_viewed = num_results_viewed;
      }

      const requestUrl = `${requestPath}${applyParamsAsString({}, userParameters, this.options)}`;
      const requestMethod = 'POST';
      const requestBody = applyParams(bodyParams, userParameters, { ...this.options, requestMethod });

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
        requestMethod,
        requestBody,
      );

      return true;
    }

    return new Error('parameters are required of type object');
  }

  /**
   * Send recommendation click event to API
   *
   * @function trackRecommendationClick
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.pod_id - Pod identifier
   * @param {string} parameters.strategy_id - Strategy identifier
   * @param {string} parameters.item_id - Product item unique identifier
   * @param {string} parameters.item_name - Product item name
   * @param {string} [parameters.variation_id] - Product item variation unique identifier
   * @param {string} [parameters.section="Products"] - Index section
   * @param {string} [parameters.result_id] - Recommendation result identifier (returned in response from Constructor)
   * @param {number} [parameters.result_count] - Total number of results
   * @param {number} [parameters.result_page] - Page number of results
   * @param {number} [parameters.result_position_on_page] - Position of result on page
   * @param {number} [parameters.num_results_per_page] - Number of results on page
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User clicked an item that appeared within a list of recommended results
   * @example
   * constructorio.tracker.trackRecommendationClick(
   *     {
   *         variation_id: 'KMH879-7632',
   *         result_id: '019927c2-f955-4020-8b8d-6b21b93cb5a2',
   *         result_count: 22,
   *         result_page: 2,
   *         result_position_on_page: 2,
   *         num_results_per_page: 12,
   *         pod_id: '019927c2-f955-4020',
   *         strategy_id: 'complimentary',
   *         item_id: 'KMH876',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackRecommendationClick(parameters, userParameters, networkParameters = {}) {
    // Ensure parameters are provided (required)
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const requestPath = `${this.options.serviceUrl}/v2/behavioral_action/recommendation_result_click?`;
      const bodyParams = {};
      const {
        variation_id,
        section,
        result_id,
        result_count,
        result_page,
        result_position_on_page,
        num_results_per_page,
        pod_id,
        strategy_id,
        item_id,
        item_name,
      } = parameters;

      if (variation_id) {
        bodyParams.variation_id = variation_id;
      }

      if (section) {
        bodyParams.section = section;
      } else {
        bodyParams.section = 'Products';
      }

      if (result_id) {
        bodyParams.result_id = result_id;
      }

      if (!helpers.isNil(result_count)) {
        bodyParams.result_count = result_count;
      }

      if (!helpers.isNil(result_page)) {
        bodyParams.result_page = result_page;
      }

      if (!helpers.isNil(result_position_on_page)) {
        bodyParams.result_position_on_page = result_position_on_page;
      }

      if (!helpers.isNil(num_results_per_page)) {
        bodyParams.num_results_per_page = num_results_per_page;
      }

      if (pod_id) {
        bodyParams.pod_id = pod_id;
      }

      if (strategy_id) {
        bodyParams.strategy_id = strategy_id;
      }

      if (item_id) {
        bodyParams.item_id = item_id;
      }

      if (item_name) {
        bodyParams.item_name = item_name;
      }

      const requestUrl = `${requestPath}${applyParamsAsString({}, userParameters, this.options)}`;
      const requestMethod = 'POST';
      const requestBody = applyParams(bodyParams, userParameters, { ...this.options, requestMethod });

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
        requestMethod,
        requestBody,
      );

      return true;
    }

    return new Error('parameters are required of type object');
  }

  /**
   * Send browse results loaded event to API
   *
   * @function trackBrowseResultsLoaded
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.url - Current page URL
   * @param {string} parameters.filter_name - Filter name
   * @param {string} parameters.filter_value - Filter value
   * @param {string} [parameters.section="Products"] - Index section
   * @param {number} [parameters.result_count] - Total number of results
   * @param {number} [parameters.result_page] - Page number of results
   * @param {string} [parameters.result_id] - Browse result identifier (returned in response from Constructor)
   * @param {object} [parameters.selected_filters] - Selected filters
   * @param {string} [parameters.sort_order] - Sort order ('ascending' or 'descending')
   * @param {string} [parameters.sort_by] - Sorting method
   * @param {object[]} [parameters.items] - List of product item objects
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User loaded a browse product listing page
   * @example
   * constructorio.tracker.trackBrowseResultsLoaded(
   *     {
   *         result_count: 22,
   *         result_page: 2,
   *         result_id: '019927c2-f955-4020-8b8d-6b21b93cb5a2',
   *         selected_filters: { brand: ['foo'], color: ['black'] },
   *         sort_order: 'ascending',
   *         sort_by: 'price',
   *         items: [{ item_id: 'KMH876' }, { item_id: 'KMH140' }],
   *         url: 'https://demo.constructor.io/sandbox/farmstand',
   *         filter_name: 'brand',
   *         filter_value: 'XYZ',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackBrowseResultsLoaded(parameters, userParameters, networkParameters = {}) {
    // Ensure parameters are provided (required)
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const requestPath = `${this.options.serviceUrl}/v2/behavioral_action/browse_result_load?`;
      const bodyParams = {};
      const {
        section,
        result_count,
        result_page,
        result_id,
        selected_filters,
        url,
        sort_order,
        sort_by,
        filter_name,
        filter_value,
        items,
      } = parameters;

      if (section) {
        bodyParams.section = section;
      } else {
        bodyParams.section = 'Products';
      }

      if (!helpers.isNil(result_count)) {
        bodyParams.result_count = result_count;
      }

      if (!helpers.isNil(result_page)) {
        bodyParams.result_page = result_page;
      }

      if (result_id) {
        bodyParams.result_id = result_id;
      }

      if (selected_filters) {
        bodyParams.selected_filters = selected_filters;
      }

      if (url) {
        bodyParams.url = url;
      }

      if (sort_order) {
        bodyParams.sort_order = sort_order;
      }

      if (sort_by) {
        bodyParams.sort_by = sort_by;
      }

      if (filter_name) {
        bodyParams.filter_name = filter_name;
      }

      if (filter_value) {
        bodyParams.filter_value = filter_value;
      }

      if (items && Array.isArray(items)) {
        bodyParams.items = items.slice(0, 100);
      }

      const requestUrl = `${requestPath}${applyParamsAsString({}, userParameters, this.options)}`;
      const requestMethod = 'POST';
      const requestBody = applyParams(bodyParams, userParameters, { ...this.options, requestMethod });

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
        requestMethod,
        requestBody,
      );

      return true;
    }

    return new Error('parameters are required of type object');
  }

  /**
   * Send browse result click event to API
   *
   * @function trackBrowseResultClick
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.filter_name - Filter name
   * @param {string} parameters.filter_value - Filter value
   * @param {string} parameters.item_id - Product item unique identifier
   * @param {string} [parameters.section="Products"] - Index section
   * @param {string} [parameters.variation_id] - Product item variation unique identifier
   * @param {string} [parameters.result_id] - Browse result identifier (returned in response from Constructor)
   * @param {number} [parameters.result_count] - Total number of results
   * @param {number} [parameters.result_page] - Page number of results
   * @param {number} [parameters.result_position_on_page] - Position of clicked item
   * @param {number} [parameters.num_results_per_page] - Number of results shown
   * @param {object} [parameters.selected_filters] -  Selected filters
   * @param {object} userParameters - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} [userParameters.userId] - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User clicked a result that appeared within a browse product listing page
   * @example
   * constructorio.tracker.trackBrowseResultClick(
   *     {
   *         variation_id: 'KMH879-7632',
   *         result_id: '019927c2-f955-4020-8b8d-6b21b93cb5a2',
   *         result_count: 22,
   *         result_page: 2,
   *         result_position_on_page: 2,
   *         num_results_per_page: 12,
   *         selected_filters: { brand: ['foo'], color: ['black'] },
   *         filter_name: 'brand',
   *         filter_value: 'XYZ',
   *         item_id: 'KMH876',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackBrowseResultClick(parameters, userParameters, networkParameters = {}) {
    // Ensure parameters are provided (required)
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
      const requestPath = `${this.options.serviceUrl}/v2/behavioral_action/browse_result_click?`;
      const bodyParams = {};
      const {
        section,
        variation_id,
        result_id,
        result_count,
        result_page,
        result_position_on_page,
        num_results_per_page,
        selected_filters,
        filter_name,
        filter_value,
        item_id,
      } = parameters;

      if (section) {
        bodyParams.section = section;
      } else {
        bodyParams.section = 'Products';
      }

      if (variation_id) {
        bodyParams.variation_id = variation_id;
      }

      if (result_id) {
        bodyParams.result_id = result_id;
      }

      if (!helpers.isNil(result_count)) {
        bodyParams.result_count = result_count;
      }

      if (!helpers.isNil(result_page)) {
        bodyParams.result_page = result_page;
      }

      if (!helpers.isNil(result_position_on_page)) {
        bodyParams.result_position_on_page = result_position_on_page;
      }

      if (!helpers.isNil(num_results_per_page)) {
        bodyParams.num_results_per_page = num_results_per_page;
      }

      if (selected_filters) {
        bodyParams.selected_filters = selected_filters;
      }

      if (filter_name) {
        bodyParams.filter_name = filter_name;
      }

      if (filter_value) {
        bodyParams.filter_value = filter_value;
      }

      if (item_id) {
        bodyParams.item_id = item_id;
      }

      const requestUrl = `${requestPath}${applyParamsAsString({}, userParameters, this.options)}`;
      const requestMethod = 'POST';
      const requestBody = applyParams(bodyParams, userParameters, { ...this.options, requestMethod });

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
        requestMethod,
        requestBody,
      );

      return true;
    }

    return new Error('parameters are required of type object');
  }

  /**
   * Send generic result click event to API
   *
   * @function trackGenericResultClick
   * @param {object} parameters - Additional parameters to be sent with request
   * @param {string} parameters.item_id - Product item unique identifier
   * @param {string} [parameters.item_name] - Product item name
   * @param {string} [parameters.variation_id] - Product item variation unique identifier
   * @param {string} [parameters.section="Products"] - Index section
   * @param {object} [userParameters] - Parameters relevant to the user request
   * @param {number} userParameters.sessionId - Session ID, utilized to personalize results
   * @param {number} userParameters.clientId - Client ID, utilized to personalize results
   * @param {string} userParameters.userId - User ID, utilized to personalize results
   * @param {string} [userParameters.segments] - User segments
   * @param {object} [userParameters.testCells] - User test cells
   * @param {string} [userParameters.originReferrer] - Client page URL (including path)
   * @param {string} [userParameters.referer] - Client page URL (including path)
   * @param {string} [userParameters.userIp] - Client user IP
   * @param {string} [userParameters.userAgent] - Client user agent
   * @param {string} [userParameters.acceptLanguage] - Client accept language
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {(true|Error)}
   * @description User clicked a result that appeared within a browse product listing page
   * @example
   * constructorio.tracker.trackGenericResultClick(
   *     {
   *         item_id: 'KMH876',
   *         item_name: 'Red T-Shirt',
   *         variation_id: 'KMH879-7632',
   *     },
   *     {
   *         sessionId: 1,
   *         clientId: '7a43138f-c87b-29c0-872d-65b00ed0e392',
   *         testCells: {
   *             testName: 'cellName',
   *         },
   *     },
   * );
   */
  trackGenericResultClick(parameters, userParameters, networkParameters = {}) {
    // Ensure required parameters are provided
    if (typeof parameters === 'object' && parameters && parameters.item_id) {
      const requestPath = `${this.options.serviceUrl}/v2/behavioral_action/result_click?`;
      const bodyParams = {};
      const {
        item_id,
        item_name,
        variation_id,
        section,
      } = parameters;

      bodyParams.section = section || 'Products';
      bodyParams.item_id = item_id;

      if (item_name) {
        bodyParams.item_name = item_name;
      }

      if (variation_id) {
        bodyParams.variation_id = variation_id;
      }

      const requestUrl = `${requestPath}${applyParamsAsString({}, userParameters, this.options)}`;
      const requestMethod = 'POST';
      const requestBody = applyParams(bodyParams, userParameters, { ...this.options, requestMethod });

      send.call(
        this,
        requestUrl,
        userParameters,
        networkParameters,
        requestMethod,
        requestBody,
      );

      return true;
    }

    return new Error('A parameters object with an "item_id" property is required.');
  }

  /**
   * Subscribe to success or error messages emitted by tracking requests
   *
   * @function on
   * @param {string} messageType - Type of message to listen for ('success' or 'error')
   * @param {function} callback - Callback to be invoked when message received
   * @returns {(true|Error)}
   * @description
   * If an error event is emitted and does not have at least one listener registered for the
   * 'error' event, the error is thrown, a stack trace is printed, and the Node.js process
   * exits - it is best practice to always bind a `.on('error')` handler
   * @see https://nodejs.org/api/events.html#events_error_events
   * @example
   * constructorio.tracker.on('error', (data) => {
   *     // Handle tracking error
   * });
   */
  on(messageType, callback) {
    if (messageType !== 'success' && messageType !== 'error') {
      return new Error('messageType must be a string of value "success" or "error"');
    }

    if (!callback || typeof callback !== 'function') {
      return new Error('callback is required and must be a function');
    }

    this.eventemitter.on(messageType, callback);

    return true;
  }
}

module.exports = Tracker;
