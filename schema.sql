-- Create syntax for TABLE 'alerts'
CREATE TABLE `alerts` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `alert` varchar(1000) DEFAULT NULL,
  `alert-class` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=latin1;

-- Create syntax for TABLE 'user_authkeys'
CREATE TABLE `user_authkeys` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL DEFAULT '',
  `auth_key` varchar(300) NOT NULL DEFAULT '',
  `expires` int(15) NOT NULL,
  `user_agent` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5019 DEFAULT CHARSET=latin1;

-- Create syntax for TABLE 'user_settings'
CREATE TABLE `user_settings` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL DEFAULT '',
  `setting` varchar(255) NOT NULL DEFAULT '',
  `value` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `identifier` (`identifier`,`setting`)
) ENGINE=InnoDB AUTO_INCREMENT=2534 DEFAULT CHARSET=latin1;

-- Create syntax for TABLE 'users'
CREATE TABLE `users` (
  `identifier` varchar(255) NOT NULL DEFAULT '',
  `shared_key` varchar(255) NOT NULL DEFAULT '',
  `created_at` int(11) DEFAULT NULL,
  `last_update` int(11) DEFAULT NULL,
  `last_ip_address` varchar(64) DEFAULT NULL,
  `created_ip_address` varchar(64) DEFAULT NULL,
  `wallet_data` longtext,
  `email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
