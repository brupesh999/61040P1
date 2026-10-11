# Reservations

Anyone can [list the reservations](reaction:Reservations.List). The
[reservation book](former:Reservations.ReservationBook) gathers them in table order.

```endpoints
Reservations.List at /reservations/list
```

A guest [reserves a table](reaction:Reservations.Reserve) under their name, and anyone can
[cancel a reservation](reaction:Reservations.Cancel).

```endpoints
Reservations.Reserve at /reservations/reserve
Reservations.Cancel at /reservations/cancel
```
