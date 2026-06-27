import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\AchievementController::index
* @see app/Http/Controllers/AchievementController.php:12
* @route '/achievements'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/achievements',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\AchievementController::index
* @see app/Http/Controllers/AchievementController.php:12
* @route '/achievements'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AchievementController::index
* @see app/Http/Controllers/AchievementController.php:12
* @route '/achievements'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AchievementController::index
* @see app/Http/Controllers/AchievementController.php:12
* @route '/achievements'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\AchievementController::index
* @see app/Http/Controllers/AchievementController.php:12
* @route '/achievements'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AchievementController::index
* @see app/Http/Controllers/AchievementController.php:12
* @route '/achievements'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AchievementController::index
* @see app/Http/Controllers/AchievementController.php:12
* @route '/achievements'
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

const AchievementController = { index }

export default AchievementController