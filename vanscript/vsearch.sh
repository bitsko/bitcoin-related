#!/bin/bash
#runs vanitysearch until stopped

read -r -p "what to search for?"$'\n' word
touch $word.txt
echo $word > .tmpword

xterm -e "./VanitySearch -c -t 3 -gpu -o $word.txt 1$word" &
xpid=$!

xterm -e "echo IyEvYmluL2Jhc2gKd29yZD0kKGNhdCAudG1wd29yZCkKd2hpbGUgdHJ1ZTsgZG8gCglscyAtaGFsICR3b3JkLnR4dCB8IGF3ayAneyBwcmludCAkNSB9JwoJbHMgLWFsICR3b3JkLnR4dCB8IGF3ayAneyBwcmludCAkNSB9JwoJc2xlZXAgNQoJY2xlYXIKZG9uZQo= | base64 -d | bash" &
zpid=$!

##base64 string decoded####
##!/bin/bash
#word=$(cat .tmpword)
#while true; do 
#	ls -hal $word.txt | awk '{ print $5 }'
#	ls -al $word.txt | awk '{ print $5 }'
#	sleep 5
#	clear
#done

xterm -e "/usr/bin/tail -f $word.txt | grep -E ^Pu" &
ypid=$!

read -r -p "press enter to kill"
kill "$xpid"
kill "$ypid"
kill "$zpid"
rm .tmpword
