#!/bin/sh

# HEX FROM CREATERAWTRANSACTION (FIRST CREATION SCRIPT: OFFLINE-COLD-CREATETX.SH)
hex=010000000262eae3f55a1d11f8469f16450e8ccf2530f9be81e25a97297a26fb7359c782190e00000000ffffffffee98a0ddbcb77a252175d3ce8a8497973871e78a68ceda2daf6fe112559f3bd30100000000ffffffff01f0490200000000001976a91455d47cc735353fb9942c3c9e455b4a12df2be6e788ac00000000

# INPUT ADDRESSES (FROM:)
tx1=1982c75973fb267a29975ae281bef93025cf8c0e45169f46f8111d5af5e3ea62
vout1=14
spub1=76a91418e3a11a85511cf2f22a9ddcb4393713024b877388ac

tx2=d33b9f5512e16faf2ddace688ae771389797848aced37521257ab7bcdda098ee
vout2=1
spub2=76a91456b16e170326ddf628f6465e9beac5a81fe6055188ac


# PRIVATE KEYS
priv1=L2ziNK6XX3kiNkijPgvauQJPLbf17T9UWMUkQXXXXXXXXXXXXXXX
priv2=KwXQnFkf3JQk35VQGYCR9uzjF8xUmYQk9RsBgXXXXXXXXXXXXXXX


bitcoin-cli signrawtransaction "$hex" "[{\"txid\":\"$tx1\",\"vout\":$vout1,\"scriptPubKey\":\"$spub1\"}, {\"txid\":\"$tx2\",\"vout\":$vout2,\"scriptPubKey\":\"$spub2\"}]" "[\"$priv1\", \"$priv2\"]"
