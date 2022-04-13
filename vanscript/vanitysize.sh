#!/bin/bash
#runs vanitysearch until output file is of a certain size

read -r -p "what to search for?"$'\n' word
touch $word.txt

xterm -geometry 100x10+100+100 -e "./VanitySearch -c -t 3 -gpu -o $word.txt 1$word" &
xpid=$!

FiftyGigs=50000000000
TenGigs=10000000000
OneGig=1000000000
HundredMegabytes=100000000
OneMegabyte=1000000
Byte=1

while true; do
        size=$(ls -al $word.txt | awk '{ print $5 }')
        hsize=$(ls -hal $word.txt | awk '{ print $5 }')
	lastkey=$(tail -n 3 $word.txt | grep -E "^Pu" | awk '{ print $2 }')
        echo -n $size $hsize $lastkey $'\r'

	#choose size variable

	if [[ $size -gt $OneMegabyte ]]; then
		kill "$xpid"
		echo $'\n' "$hsize" "$word".txt
		exit 1
	else
		sleep 3
	fi
done
