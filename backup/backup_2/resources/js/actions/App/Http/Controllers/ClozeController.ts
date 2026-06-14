import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\ClozeController::index
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/words/cloze',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ClozeController::index
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ClozeController::index
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ClozeController::index
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ClozeController::index
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ClozeController::index
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ClozeController::index
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
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

const ClozeController = { index }

export default ClozeController