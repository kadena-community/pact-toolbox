(namespace 'free)

(module todos GOVERNANCE
  "A simple todos module"

  (defcap GOVERNANCE ()
    "A capability to administer the todos module"
    true)

  (defschema todo
    "A todo item"
    id:string
    title:string
    completed:bool
    deleted:bool
  )

  (deftable todo-table:{todo})

  (defun create-todo:string (id:string title:string)
    "Create new todo with ID and TITLE."
    (insert todo-table id {
      "id": id,
      "title": title,
      "completed": false,
      "deleted": false
    })
  )

  (defun toggle-todo:bool (id:string)
    "Toggle completed status flag for todo at ID."
    (with-read todo-table id { "completed":= state }
      (update todo-table id { "completed": (not state) })
    )
  )

  (defun update-todo:string (id:string title:string)
    "Update todo at ID."
    (update todo-table id { "title": title })
  )

  (defun delete-todo:string (id:string)
    "Delete todo at ID (by setting deleted flag)."
    (update todo-table id { "deleted": true })
  )

  (defun get-todo:object{todo} (id:string)
    "Get a single todo"
    (read todo-table id)
  )

  (defun get-todos:[object{todo}] ()
    "Get all todos."
    (filter (lambda (todo) (= (at "deleted" todo) false)) (map (get-todo) (keys todo-table)))
  )
)

(if (read-msg "upgrade") ["Module upgraded"] [(create-table todo-table)])
