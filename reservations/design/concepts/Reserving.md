# Reserving

## Purpose

Hold a resource for one user at a time, so two people never end up with the same table.

## Principle

Barish reserves friday-7pm-table-4. When Eagon then tries to reserve the same table, the
request is refused. After Barish cancels, Carmel can reserve it.

## Types

```types
external User
  The person who holds a reservation.

external Resource
  The thing being reserved, such as a table at a certain time.
```

## State

```state
a set of Reservations with
  a User
  a unique Resource
```

## Actions

```actions
reserve(user: User, resource: Resource) : returns (reservation: Reservation)
  where resource is already reserved
  then
    refuses ALREADY_RESERVED "That resource is already reserved."
  where resource is not reserved
  then
    add a new reservation with user and resource
    returns reservation

cancel(reservation: Reservation) : returns (reservation: Reservation)
  where reservation is in Reservations
  then
    remove reservation
    returns reservation
  where reservation is not in Reservations
  then
    refuses NO_SUCH_RESERVATION "There is no such reservation."
```

## Queries

```queries
_all() : many (reservation: Reservation, user: User, resource: Resource)
  Answers every reservation, ordered by resource, and no rows when there are none.
```
