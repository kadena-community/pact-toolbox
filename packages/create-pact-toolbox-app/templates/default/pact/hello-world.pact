(namespace 'free)

(module hello-world GOVERNANCE
  "A simple hello-world module"

  (defcap GOVERNANCE ()
    "A capability to administer the hello-world module"
    true)

  (defun say-hello (name:string)
    "Says hello to the given name"
    (format "Hello {}!" [name])
  )
)
