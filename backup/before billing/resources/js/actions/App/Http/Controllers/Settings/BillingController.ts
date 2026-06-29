import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Settings\BillingController::edit
* @see app/Http/Controllers/Settings/BillingController.php:14
* @route '/settings/billing'
*/
export const edit = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/settings/billing',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Settings\BillingController::edit
* @see app/Http/Controllers/Settings/BillingController.php:14
* @route '/settings/billing'
*/
edit.url = (options?: RouteQueryOptions) => {
    return edit.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Settings\BillingController::edit
* @see app/Http/Controllers/Settings/BillingController.php:14
* @route '/settings/billing'
*/
edit.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Settings\BillingController::edit
* @see app/Http/Controllers/Settings/BillingController.php:14
* @route '/settings/billing'
*/
edit.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\Settings\BillingController::edit
* @see app/Http/Controllers/Settings/BillingController.php:14
* @route '/settings/billing'
*/
const editForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Settings\BillingController::edit
* @see app/Http/Controllers/Settings/BillingController.php:14
* @route '/settings/billing'
*/
editForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Settings\BillingController::edit
* @see app/Http/Controllers/Settings/BillingController.php:14
* @route '/settings/billing'
*/
editForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

edit.form = editForm

/**
* @see \App\Http\Controllers\Settings\BillingController::update
* @see app/Http/Controllers/Settings/BillingController.php:24
* @route '/settings/billing'
*/
export const update = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/settings/billing',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Settings\BillingController::update
* @see app/Http/Controllers/Settings/BillingController.php:24
* @route '/settings/billing'
*/
update.url = (options?: RouteQueryOptions) => {
    return update.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Settings\BillingController::update
* @see app/Http/Controllers/Settings/BillingController.php:24
* @route '/settings/billing'
*/
update.put = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\Settings\BillingController::update
* @see app/Http/Controllers/Settings/BillingController.php:24
* @route '/settings/billing'
*/
const updateForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Settings\BillingController::update
* @see app/Http/Controllers/Settings/BillingController.php:24
* @route '/settings/billing'
*/
updateForm.put = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

const BillingController = { edit, update }

export default BillingController