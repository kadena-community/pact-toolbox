(namespace "free")

(module todos GOVERNANCE
  (defcap GOVERNANCE() true)
  
  (defun read-all()
    "Read all todos."
    ["Learn pact", "Write your first contract"]
  )

  (defun read-one(id)
    "Read one todo."
    (if (= id 1)
      "Learn pact"
      "Write your first contract"
    )
  )

  (defun create(todo)
    "Create a todo."
    todo
  )
)
