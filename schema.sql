CREATE TABLE `users` (
  `identifier` varchar(255) NOT NULL DEFAULT '',
  `shared_key` varchar(255) NOT NULL DEFAULT '',
  `wallet_data` longtext,
  PRIMARY KEY (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;