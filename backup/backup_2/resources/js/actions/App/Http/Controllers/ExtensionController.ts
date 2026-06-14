import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\ExtensionController::lookup
* @see app/Http/Controllers/ExtensionController.php:14
* @route '/extension/lookup'
*/
export const lookup = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: lookup.url(options),
    method: 'get',
})

lookup.definition = {
    methods: ["get","head"],
    url: '/extension/lookup',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ExtensionController::lookup
* @see app/Http/Controllers/ExtensionController.php:14
* @route '/extension/lookup'
*/
lookup.url = (options?: RouteQueryOptions) => {
    return lookup.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ExtensionController::lookup
* @see app/Http/Controllers/ExtensionController.php:14
* @route '/extension/lookup'
*/
lookup.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: lookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::lookup
* @see app/Http/Controllers/ExtensionController.php:14
* @route '/extension/lookup'
*/
lookup.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: lookup.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ExtensionController::lookup
* @see app/Http/Controllers/ExtensionController.php:14
* @route '/extension/lookup'
*/
const lookupForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: lookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::lookup
* @see app/Http/Controllers/ExtensionController.php:14
* @route '/extension/lookup'
*/
lookupForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: lookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::lookup
* @see app/Http/Controllers/ExtensionController.php:14
* @route '/extension/lookup'
*/
lookupForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: lookup.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

lookup.form = lookupForm

/**
* @see \App\Http\Controllers\ExtensionController::search
* @see app/Http/Controllers/ExtensionController.php:191
* @route '/extension/search'
*/
export const search = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: search.url(options),
    method: 'get',
})

search.definition = {
    methods: ["get","head"],
    url: '/extension/search',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ExtensionController::search
* @see app/Http/Controllers/ExtensionController.php:191
* @route '/extension/search'
*/
search.url = (options?: RouteQueryOptions) => {
    return search.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ExtensionController::search
* @see app/Http/Controllers/ExtensionController.php:191
* @route '/extension/search'
*/
search.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: search.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::search
* @see app/Http/Controllers/ExtensionController.php:191
* @route '/extension/search'
*/
search.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: search.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ExtensionController::search
* @see app/Http/Controllers/ExtensionController.php:191
* @route '/extension/search'
*/
const searchForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: search.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::search
* @see app/Http/Controllers/ExtensionController.php:191
* @route '/extension/search'
*/
searchForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: search.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::search
* @see app/Http/Controllers/ExtensionController.php:191
* @route '/extension/search'
*/
searchForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: search.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

search.form = searchForm

/**
* @see \App\Http\Controllers\ExtensionController::statuses
* @see app/Http/Controllers/ExtensionController.php:148
* @route '/extension/statuses'
*/
export const statuses = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: statuses.url(options),
    method: 'get',
})

statuses.definition = {
    methods: ["get","head"],
    url: '/extension/statuses',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ExtensionController::statuses
* @see app/Http/Controllers/ExtensionController.php:148
* @route '/extension/statuses'
*/
statuses.url = (options?: RouteQueryOptions) => {
    return statuses.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ExtensionController::statuses
* @see app/Http/Controllers/ExtensionController.php:148
* @route '/extension/statuses'
*/
statuses.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: statuses.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::statuses
* @see app/Http/Controllers/ExtensionController.php:148
* @route '/extension/statuses'
*/
statuses.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: statuses.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ExtensionController::statuses
* @see app/Http/Controllers/ExtensionController.php:148
* @route '/extension/statuses'
*/
const statusesForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: statuses.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::statuses
* @see app/Http/Controllers/ExtensionController.php:148
* @route '/extension/statuses'
*/
statusesForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: statuses.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::statuses
* @see app/Http/Controllers/ExtensionController.php:148
* @route '/extension/statuses'
*/
statusesForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: statuses.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

statuses.form = statusesForm

/**
* @see \App\Http\Controllers\ExtensionController::badge
* @see app/Http/Controllers/ExtensionController.php:173
* @route '/extension/badge'
*/
export const badge = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: badge.url(options),
    method: 'get',
})

badge.definition = {
    methods: ["get","head"],
    url: '/extension/badge',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ExtensionController::badge
* @see app/Http/Controllers/ExtensionController.php:173
* @route '/extension/badge'
*/
badge.url = (options?: RouteQueryOptions) => {
    return badge.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ExtensionController::badge
* @see app/Http/Controllers/ExtensionController.php:173
* @route '/extension/badge'
*/
badge.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: badge.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::badge
* @see app/Http/Controllers/ExtensionController.php:173
* @route '/extension/badge'
*/
badge.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: badge.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ExtensionController::badge
* @see app/Http/Controllers/ExtensionController.php:173
* @route '/extension/badge'
*/
const badgeForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: badge.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::badge
* @see app/Http/Controllers/ExtensionController.php:173
* @route '/extension/badge'
*/
badgeForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: badge.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ExtensionController::badge
* @see app/Http/Controllers/ExtensionController.php:173
* @route '/extension/badge'
*/
badgeForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: badge.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

badge.form = badgeForm

/**
* @see \App\Http\Controllers\ExtensionController::addWord
* @see app/Http/Controllers/ExtensionController.php:103
* @route '/extension/add-word'
*/
export const addWord = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: addWord.url(options),
    method: 'post',
})

addWord.definition = {
    methods: ["post"],
    url: '/extension/add-word',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ExtensionController::addWord
* @see app/Http/Controllers/ExtensionController.php:103
* @route '/extension/add-word'
*/
addWord.url = (options?: RouteQueryOptions) => {
    return addWord.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ExtensionController::addWord
* @see app/Http/Controllers/ExtensionController.php:103
* @route '/extension/add-word'
*/
addWord.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: addWord.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ExtensionController::addWord
* @see app/Http/Controllers/ExtensionController.php:103
* @route '/extension/add-word'
*/
const addWordForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: addWord.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ExtensionController::addWord
* @see app/Http/Controllers/ExtensionController.php:103
* @route '/extension/add-word'
*/
addWordForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: addWord.url(options),
    method: 'post',
})

addWord.form = addWordForm

const ExtensionController = { lookup, search, statuses, badge, addWord }

export default ExtensionController