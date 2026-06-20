import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:521
* @route '/text-analysis/books'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/text-analysis/books',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:521
* @route '/text-analysis/books'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:521
* @route '/text-analysis/books'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:521
* @route '/text-analysis/books'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:521
* @route '/text-analysis/books'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:521
* @route '/text-analysis/books'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::index
* @see app/Http/Controllers/TextAnalysisController.php:521
* @route '/text-analysis/books'
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
* @see app/Http/Controllers/TextAnalysisController.php:1101
* @route '/text-analysis/books'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/text-analysis/books',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1101
* @route '/text-analysis/books'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1101
* @route '/text-analysis/books'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1101
* @route '/text-analysis/books'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::store
* @see app/Http/Controllers/TextAnalysisController.php:1101
* @route '/text-analysis/books'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1170
* @route '/text-analysis/books/{book}/page'
*/
export const page = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: page.url(args, options),
    method: 'get',
})

page.definition = {
    methods: ["get","head"],
    url: '/text-analysis/books/{book}/page',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1170
* @route '/text-analysis/books/{book}/page'
*/
page.url = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { book: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { book: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            book: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        book: typeof args.book === 'object'
        ? args.book.id
        : args.book,
    }

    return page.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1170
* @route '/text-analysis/books/{book}/page'
*/
page.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: page.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1170
* @route '/text-analysis/books/{book}/page'
*/
page.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: page.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1170
* @route '/text-analysis/books/{book}/page'
*/
const pageForm = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: page.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1170
* @route '/text-analysis/books/{book}/page'
*/
pageForm.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: page.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::page
* @see app/Http/Controllers/TextAnalysisController.php:1170
* @route '/text-analysis/books/{book}/page'
*/
pageForm.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see app/Http/Controllers/TextAnalysisController.php:1183
* @route '/text-analysis/books/{book}/overview'
*/
export const overview = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: overview.url(args, options),
    method: 'get',
})

overview.definition = {
    methods: ["get","head"],
    url: '/text-analysis/books/{book}/overview',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1183
* @route '/text-analysis/books/{book}/overview'
*/
overview.url = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { book: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { book: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            book: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        book: typeof args.book === 'object'
        ? args.book.id
        : args.book,
    }

    return overview.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1183
* @route '/text-analysis/books/{book}/overview'
*/
overview.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: overview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1183
* @route '/text-analysis/books/{book}/overview'
*/
overview.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: overview.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1183
* @route '/text-analysis/books/{book}/overview'
*/
const overviewForm = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: overview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1183
* @route '/text-analysis/books/{book}/overview'
*/
overviewForm.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: overview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::overview
* @see app/Http/Controllers/TextAnalysisController.php:1183
* @route '/text-analysis/books/{book}/overview'
*/
overviewForm.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see app/Http/Controllers/TextAnalysisController.php:1195
* @route '/text-analysis/books/{book}'
*/
export const destroy = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/text-analysis/books/{book}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1195
* @route '/text-analysis/books/{book}'
*/
destroy.url = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { book: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { book: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            book: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        book: typeof args.book === 'object'
        ? args.book.id
        : args.book,
    }

    return destroy.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1195
* @route '/text-analysis/books/{book}'
*/
destroy.delete = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::destroy
* @see app/Http/Controllers/TextAnalysisController.php:1195
* @route '/text-analysis/books/{book}'
*/
const destroyForm = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see app/Http/Controllers/TextAnalysisController.php:1195
* @route '/text-analysis/books/{book}'
*/
destroyForm.delete = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const books = {
    index: Object.assign(index, index),
    store: Object.assign(store, store),
    page: Object.assign(page, page),
    overview: Object.assign(overview, overview),
    destroy: Object.assign(destroy, destroy),
}

export default books