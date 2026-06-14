import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:14
* @route '/admin'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/admin',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:14
* @route '/admin'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:14
* @route '/admin'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:14
* @route '/admin'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:14
* @route '/admin'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:14
* @route '/admin'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:14
* @route '/admin'
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
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
export const toggleAiAccess = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: toggleAiAccess.url(options),
    method: 'post',
})

toggleAiAccess.definition = {
    methods: ["post"],
    url: '/admin/ai-access',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
toggleAiAccess.url = (options?: RouteQueryOptions) => {
    return toggleAiAccess.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
toggleAiAccess.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: toggleAiAccess.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
const toggleAiAccessForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggleAiAccess.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
toggleAiAccessForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggleAiAccess.url(options),
    method: 'post',
})

toggleAiAccess.form = toggleAiAccessForm

const AdminController = { index, toggleAiAccess }

export default AdminController