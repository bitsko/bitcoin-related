#!/bin/bash
ncli(){ $HOME/.novo-bitcoin/bin/novobitcoin-cli $1 $2 $3 $4 $5 $6; }
while read -r line; do
	ncli dumpprivkey "$line"
done<<<"$(ncli listunspent | jq -r .[].address | sort | uniq)"
