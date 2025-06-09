(namespace "free")
(module hello2 GOVERNANCE
  (defcap GOVERNANCE ()
    (enforce-keyset "free.admin-keyset")
  )
  (defun test (name:string)
    (format "Hello from hello2 module!")
  )
)

(if (read-msg "upgrade")
  ["Module upgraded."]
  []
)