import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\UserCustomWordController::store
* @see app/Http/Controllers/UserCustomWordController.php:25
* @route '/custom-words'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/custom-words',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UserCustomWordController::store
* @see app/Http/Controllers/UserCustomWordController.php:25
* @route '/custom-words'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\UserCustomWordController::store
* @see app/Http/Controllers/UserCustomWordController.php:25
* @route '/custom-words'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::store
* @see app/Http/Controllers/UserCustomWordController.php:25
* @route '/custom-words'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::store
* @see app/Http/Controllers/UserCustomWordController.php:25
* @route '/custom-words'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\UserCustomWordController::update
* @see app/Http/Controllers/UserCustomWordController.php:45
* @route '/custom-words/{customWord}'
*/
export const update = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/custom-words/{customWord}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\UserCustomWordController::update
* @see app/Http/Controllers/UserCustomWordController.php:45
* @route '/custom-words/{customWord}'
*/
update.url = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { customWord: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { customWord: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            customWord: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        customWord: typeof args.customWord === 'object'
        ? args.customWord.id
        : args.customWord,
    }

    return update.definition.url
            .replace('{customWord}', parsedArgs.customWord.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UserCustomWordController::update
* @see app/Http/Controllers/UserCustomWordController.php:45
* @route '/custom-words/{customWord}'
*/
update.patch = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::update
* @see app/Http/Controllers/UserCustomWordController.php:45
* @route '/custom-words/{customWord}'
*/
const updateForm = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::update
* @see app/Http/Controllers/UserCustomWordController.php:45
* @route '/custom-words/{customWord}'
*/
updateForm.patch = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

/**
* @see \App\Http\Controllers\UserCustomWordController::status
* @see app/Http/Controllers/UserCustomWordController.php:75
* @route '/custom-words/{customWord}/status'
*/
export const status = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: status.url(args, options),
    method: 'post',
})

status.definition = {
    methods: ["post"],
    url: '/custom-words/{customWord}/status',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UserCustomWordController::status
* @see app/Http/Controllers/UserCustomWordController.php:75
* @route '/custom-words/{customWord}/status'
*/
status.url = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { customWord: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { customWord: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            customWord: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        customWord: typeof args.customWord === 'object'
        ? args.customWord.id
        : args.customWord,
    }

    return status.definition.url
            .replace('{customWord}', parsedArgs.customWord.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UserCustomWordController::status
* @see app/Http/Controllers/UserCustomWordController.php:75
* @route '/custom-words/{customWord}/status'
*/
status.post = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: status.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::status
* @see app/Http/Controllers/UserCustomWordController.php:75
* @route '/custom-words/{customWord}/status'
*/
const statusForm = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: status.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::status
* @see app/Http/Controllers/UserCustomWordController.php:75
* @route '/custom-words/{customWord}/status'
*/
statusForm.post = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: status.url(args, options),
    method: 'post',
})

status.form = statusForm

/**
* @see \App\Http\Controllers\UserCustomWordController::importance
* @see app/Http/Controllers/UserCustomWordController.php:102
* @route '/custom-words/{customWord}/importance'
*/
export const importance = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importance.url(args, options),
    method: 'post',
})

importance.definition = {
    methods: ["post"],
    url: '/custom-words/{customWord}/importance',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\UserCustomWordController::importance
* @see app/Http/Controllers/UserCustomWordController.php:102
* @route '/custom-words/{customWord}/importance'
*/
importance.url = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { customWord: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { customWord: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            customWord: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        customWord: typeof args.customWord === 'object'
        ? args.customWord.id
        : args.customWord,
    }

    return importance.definition.url
            .replace('{customWord}', parsedArgs.customWord.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UserCustomWordController::importance
* @see app/Http/Controllers/UserCustomWordController.php:102
* @route '/custom-words/{customWord}/importance'
*/
importance.post = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importance.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::importance
* @see app/Http/Controllers/UserCustomWordController.php:102
* @route '/custom-words/{customWord}/importance'
*/
const importanceForm = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importance.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::importance
* @see app/Http/Controllers/UserCustomWordController.php:102
* @route '/custom-words/{customWord}/importance'
*/
importanceForm.post = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importance.url(args, options),
    method: 'post',
})

importance.form = importanceForm

/**
* @see \App\Http\Controllers\UserCustomWordController::destroy
* @see app/Http/Controllers/UserCustomWordController.php:113
* @route '/custom-words/{customWord}'
*/
export const destroy = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/custom-words/{customWord}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\UserCustomWordController::destroy
* @see app/Http/Controllers/UserCustomWordController.php:113
* @route '/custom-words/{customWord}'
*/
destroy.url = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { customWord: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { customWord: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            customWord: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        customWord: typeof args.customWord === 'object'
        ? args.customWord.id
        : args.customWord,
    }

    return destroy.definition.url
            .replace('{customWord}', parsedArgs.customWord.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\UserCustomWordController::destroy
* @see app/Http/Controllers/UserCustomWordController.php:113
* @route '/custom-words/{customWord}'
*/
destroy.delete = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::destroy
* @see app/Http/Controllers/UserCustomWordController.php:113
* @route '/custom-words/{customWord}'
*/
const destroyForm = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\UserCustomWordController::destroy
* @see app/Http/Controllers/UserCustomWordController.php:113
* @route '/custom-words/{customWord}'
*/
destroyForm.delete = (args: { customWord: number | { id: number } } | [customWord: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const UserCustomWordController = { store, update, status, importance, destroy }

export default UserCustomWordController