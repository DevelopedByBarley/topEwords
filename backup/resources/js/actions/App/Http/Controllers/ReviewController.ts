import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\ReviewController::index
* @see app/Http/Controllers/ReviewController.php:31
* @route '/review'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/review',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ReviewController::index
* @see app/Http/Controllers/ReviewController.php:31
* @route '/review'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ReviewController::index
* @see app/Http/Controllers/ReviewController.php:31
* @route '/review'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ReviewController::index
* @see app/Http/Controllers/ReviewController.php:31
* @route '/review'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ReviewController::index
* @see app/Http/Controllers/ReviewController.php:31
* @route '/review'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ReviewController::index
* @see app/Http/Controllers/ReviewController.php:31
* @route '/review'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ReviewController::index
* @see app/Http/Controllers/ReviewController.php:31
* @route '/review'
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
* @see \App\Http\Controllers\ReviewController::complete
* @see app/Http/Controllers/ReviewController.php:141
* @route '/review/complete'
*/
export const complete = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: complete.url(options),
    method: 'post',
})

complete.definition = {
    methods: ["post"],
    url: '/review/complete',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\ReviewController::complete
* @see app/Http/Controllers/ReviewController.php:141
* @route '/review/complete'
*/
complete.url = (options?: RouteQueryOptions) => {
    return complete.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ReviewController::complete
* @see app/Http/Controllers/ReviewController.php:141
* @route '/review/complete'
*/
complete.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: complete.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ReviewController::complete
* @see app/Http/Controllers/ReviewController.php:141
* @route '/review/complete'
*/
const completeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: complete.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\ReviewController::complete
* @see app/Http/Controllers/ReviewController.php:141
* @route '/review/complete'
*/
completeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: complete.url(options),
    method: 'post',
})

complete.form = completeForm

const ReviewController = { index, complete }

export default ReviewController