#!/bin/bash

# while read -r line; do ncli dumpprivkey "$line"; done<<<$(grep address<<<$(ncli listunspent) | sort | uniq | cut -d '"' -f 4)

ncli(){ $HOME/.novo/bin/novo-cli $1 $2 $3 $4 $5 $6; }
while read -r line; do
	ncli dumpprivkey "$line"
done<<<"$(ncli listunspent | jq -r .[].address | sort | uniq)"
