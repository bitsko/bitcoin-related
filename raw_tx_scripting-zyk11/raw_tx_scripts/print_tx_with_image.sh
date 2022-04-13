#!/bin/bash

# Automating the creation of a normal transaction, but printing the JSON curl output instead of sending it to the network
# Used for debugging purposes only

#Creates transaction in JSON format
curl_rpc_json(){

	unset CURL_CMD
	CURL_CMD="curl -s --user USER:PASS --data-binary '{\"jsonrpc\": \"1.0\", \"id\":\"curltest\",\"method\":\"createrawtransaction\", \"params\": [''[ { \"txid\": \"'\$UTXO_TXID'\", \"vout\": '\$UTXO_VOUT' } ]'',''{ "
	for i in "${NEW_ADDRESS[@]}"
	do
		if [ "$i" != ${NEW_ADDRESS[-1]} ];
		then
			CURL_CMD+="\"'$i'\": '\$AMOUNT',"
		else
			CURL_CMD+="\"'$i'\": '\$AMOUNT'"
		fi
	done
	CURL_CMD+="}'']}' -H 'content-type: text/plain;' http://localhost:16590 | jq -r '.result'"

	#print constructed command with addresses
	echo $CURL_CMD
}

#Constructs raw transaction from available UTXOs
create_raw_tx() {

	#get TXID for first spendable UTXO from wallet, minimum 1 bitcoin
	UTXO_TXID=$(curl -s --user USER:PASS --data-binary \
	'{"jsonrpc":"1.0", "id":"curltest", "method":"listunspent","params":[6, 9999999, [] , true, { "minimumAmount": 1 } ]}' \
	-H 'content-type:text/plain;' http://localhost:16590 | jq -r '.result | .[0] | .txid')
	echo "[*] UTXO_TXID: " $UTXO_TXID

	#get amount for first spendable UTXO, minimum 1 bitcoin
	UTXO_AMOUNT=$(curl -s --user USER:PASS --data-binary \
	'{"jsonrpc":"1.0", "id":"curltest", "method":"listunspent","params":[6, 9999999, [] , true, { "minimumAmount": 1 } ]}' \
	-H 'content-type:text/plain;' http://localhost:16590 | jq -r '.result | .[0] | .amount')
	echo "[*] UTXO_AMOUNT: " $UTXO_AMOUNT

	#get VOUT ID for first spendable UTXO, minimum 1 bitcoin 
	UTXO_VOUT=$(curl -s --user USER:PASS --data-binary \
	'{"jsonrpc":"1.0", "id":"curltest", "method":"listunspent","params":[]}' \
	-H 'content-type:text/plain;' http://localhost:16590 | jq -r '.result | .[0] | .vout')
	echo "[*] UTXO_VOUT: " $UTXO_VOUT

	#Subtract fee from UTXO_AMOUNT
	AMOUNT=$(echo $UTXO_AMOUNT - 0.0001 | bc)
	#Get number of 20-byte chunks
	n=$(wc -l < $hex_input)
	#Divide total AMOUNT by total number of adresses required, to 8 decimal places
	AMOUNT=$(echo "scale=8; $AMOUNT/$n" | bc -l | awk '{printf "%.8f\n", $0}')

	#create raw transaction
	curl_rpc_json
}

#Generates Bitcoin addresses in the correct format representing the image
generate_addresses() {
	hex_input=$1
	n=1
	while read -r line; do
        NEW_ADDRESS[$n]=$( printf $line | base58 -c)
        ((n++))
  	done < $hex_input
}

main(){

	if [ "$1" ]
	then
		echo "[*] Generating Bitcoin addresses representing the image"
		generate_addresses $1
		echo "[*] Creating raw transaction"
		create_raw_tx
	else
		echo "[-] Image hex input expected"
	fi
}

main $1
