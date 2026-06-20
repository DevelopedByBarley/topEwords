import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:996
* @route '/text-analysis/youtube'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/text-analysis/youtube',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:996
* @route '/text-analysis/youtube'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:996
* @route '/text-analysis/youtube'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:996
* @route '/text-analysis/youtube'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:996
* @route '/text-analysis/youtube'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:996
* @route '/text-analysis/youtube'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:996
* @route '/text-analysis/youtube'
*/
indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1011
* @route '/text-analysis/youtube'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/text-analysis/youtube',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1011
* @route '/text-analysis/youtube'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1011
* @route '/text-analysis/youtube'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1011
* @route '/text-analysis/youtube'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1011
* @route '/text-analysis/youtube'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1065
* @route '/text-analysis/youtube/{transcript}/page'
*/
export const page = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: page.url(args, options),
    method: 'get',
})

page.definition = {
    methods: ["get","head"],
    url: '/text-analysis/youtube/{transcript}/page',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1065
* @route '/text-analysis/youtube/{transcript}/page'
*/
page.url = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { transcript: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { transcript: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            transcript: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        transcript: typeof args.transcript === 'object'
        ? args.transcript.id
        : args.transcript,
    }

    return page.definition.url
            .replace('{transcript}', parsedArgs.transcript.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1065
* @route '/text-analysis/youtube/{transcript}/page'
*/
page.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: page.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1065
* @route '/text-analysis/youtube/{transcript}/page'
*/
page.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: page.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1065
* @route '/text-analysis/youtube/{transcript}/page'
*/
const pageForm = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: page.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1065
* @route '/text-analysis/youtube/{transcript}/page'
*/
pageForm.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: page.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1065
* @route '/text-analysis/youtube/{transcript}/page'
*/
pageForm.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: page.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

page.form = pageForm

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1080
* @route '/text-analysis/youtube/{transcript}/overview'
*/
export const overview = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: overview.url(args, options),
    method: 'get',
})

overview.definition = {
    methods: ["get","head"],
    url: '/text-analysis/youtube/{transcript}/overview',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1080
* @route '/text-analysis/youtube/{transcript}/overview'
*/
overview.url = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { transcript: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { transcript: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            transcript: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        transcript: typeof args.transcript === 'object'
        ? args.transcript.id
        : args.transcript,
    }

    return overview.definition.url
            .replace('{transcript}', parsedArgs.transcript.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1080
* @route '/text-analysis/youtube/{transcript}/overview'
*/
overview.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: overview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1080
* @route '/text-analysis/youtube/{transcript}/overview'
*/
overview.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: overview.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1080
* @route '/text-analysis/youtube/{transcript}/overview'
*/
const overviewForm = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: overview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1080
* @route '/text-analysis/youtube/{transcript}/overview'
*/
overviewForm.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: overview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1080
* @route '/text-analysis/youtube/{transcript}/overview'
*/
overviewForm.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: overview.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

overview.form = overviewForm

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1093
* @route '/text-analysis/youtube/{transcript}'
*/
export const destroy = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/text-analysis/youtube/{transcript}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1093
* @route '/text-analysis/youtube/{transcript}'
*/
destroy.url = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { transcript: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { transcript: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            transcript: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        transcript: typeof args.transcript === 'object'
        ? args.transcript.id
        : args.transcript,
    }

    return destroy.definition.url
            .replace('{transcript}', parsedArgs.transcript.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1093
* @route '/text-analysis/youtube/{transcript}'
*/
destroy.delete = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1093
* @route '/text-analysis/youtube/{transcript}'
*/
const destroyForm = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1093
* @route '/text-analysis/youtube/{transcript}'
*/
destroyForm.delete = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const youtube = {
    index: Object.assign(index, index),
    store: Object.assign(store, store),
    page: Object.assign(page, page),
    overview: Object.assign(overview, overview),
    destroy: Object.assign(destroy, destroy),
}

export default youtube