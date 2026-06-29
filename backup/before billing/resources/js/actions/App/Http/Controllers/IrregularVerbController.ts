import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\IrregularVerbController::index
* @see app/Http/Controllers/IrregularVerbController.php:11
* @route '/irregular-verbs'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/irregular-verbs',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\IrregularVerbController::index
* @see app/Http/Controllers/IrregularVerbController.php:11
* @route '/irregular-verbs'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\IrregularVerbController::index
* @see app/Http/Controllers/IrregularVerbController.php:11
* @route '/irregular-verbs'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\IrregularVerbController::index
* @see app/Http/Controllers/IrregularVerbController.php:11
* @route '/irregular-verbs'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\IrregularVerbController::index
* @see app/Http/Controllers/IrregularVerbController.php:11
* @route '/irregular-verbs'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\IrregularVerbController::index
* @see app/Http/Controllers/IrregularVerbController.php:11
* @route '/irregular-verbs'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\IrregularVerbController::index
* @see app/Http/Controllers/IrregularVerbController.php:11
* @route '/irregular-verbs'
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

const IrregularVerbController = { index }

export default IrregularVerbController