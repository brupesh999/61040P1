# Application types

Guests type their own name, and each reservation holds one table at one time.

```types
concrete Name
  The name a guest types in when reserving.

concrete Table
  A table at a certain time, such as friday-7pm-table-4.
```

```instances
instantiate Reserving with
  User is Name
  Resource is Table
```
