import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\FolderWordController::update
* @see app/Http/Controllers/FolderWordController.php:13
* @route '/folders/{folder}/words/{word}'
*/
export const update = (args: { folder: number | { id: number }, word: number | { id: number } } | [folder: number | { id: number }, word: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/folders/{folder}/words/{word}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\FolderWordController::update
* @see app/Http/Controllers/FolderWordController.php:13
* @route '/folders/{folder}/words/{word}'
*/
update.url = (args: { folder: number | { id: number }, word: number | { id: number } } | [folder: number | { id: number }, word: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            folder: args[0],
            word: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        folder: typeof args.folder === 'object'
        ? args.folder.id
        : args.folder,
        word: typeof args.word === 'object'
        ? args.word.id
        : args.word,
    }

    return update.definition.url
            .replace('{folder}', parsedArgs.folder.toString())
            .replace('{word}', parsedArgs.word.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FolderWordController::update
* @see app/Http/Controllers/FolderWordController.php:13
* @route '/folders/{folder}/words/{word}'
*/
update.patch = (args: { folder: number | { id: number }, word: number | { id: number } } | [folder: number | { id: number }, word: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\FolderWordController::update
* @see app/Http/Controllers/FolderWordController.php:13
* @route '/folders/{folder}/words/{word}'
*/
const updateForm = (args: { folder: number | { id: number }, word: number | { id: number } } | [folder: number | { id: number }, word: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FolderWordController::update
* @see app/Http/Controllers/FolderWordController.php:13
* @route '/folders/{folder}/words/{word}'
*/
updateForm.patch = (args: { folder: number | { id: number }, word: number | { id: number } } | [folder: number | { id: number }, word: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

const words = {
    update: Object.assign(update, update),
}

export default words