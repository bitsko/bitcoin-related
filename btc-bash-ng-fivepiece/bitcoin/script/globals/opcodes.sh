#!/bin/bash

declare -A opcodes

opcodes=( 
    [0]='00'
    [FALSE]='00'
    [PUSHDATA1]='4C'
    [PUSHDATA2]='4D'
    [PUSHDATA4]='4E'
    [1NEGATE]='4F'
    [RESERVED]='50'
    [1]='51'
    [2]='52'
    [3]='53'
    [4]='54'
    [5]='55'
    [6]='56'
    [7]='57'
    [8]='58'
    [9]='59'
    [10]='5A'
    [11]='5B'
    [12]='5C'
    [13]='5D'
    [14]='5E'
    [15]='5F'
    [16]='60'
    [NOP]='61'
    [VER]='62'
    [IF]='63'
    [NOTIF]='64'
    [VERIF]='65'
    [VERNOTIF]='66'
    [ELSE]='67'
    [ENDIF]='68'
    [VERIFY]='69'
    [RETURN]='6A'
    [TOALTSTACK]='6B'
    [FROMALTSTACK]='6C'
    [2DROP]='6D'
    [2DUP]='6E'
    [3DUP]='6F'
    [2OVER]='70'
    [2ROT]='71'
    [2SWAP]='72'
    [IFDUP]='73'
    [DEPTH]='74'
    [DROP]='75'
    [DUP]='76'
    [NIP]='77'
    [OVER]='78'
    [PICK]='79'
    [ROLL]='7A'
    [ROT]='7B'
    [SWAP]='7C'
    [TUCK]='7D'
    [CAT]='7E'
    [SUBSTR]='7F'
    [SPLIT]='7F'
    [LEFT]='80'
    [NUM2BIN]='80'
    [RIGHT]='81'
    [BIN2NUM]='81'
    [SIZE]='82'
    [INVERT]='83'
    [AND]='84'
    [OR]='85'
    [XOR]='86'
    [EQUAL]='87'
    [EQUALVERIFY]='88'
    [RESERVED1]='89'
    [RESERVED2]='8A'
    [1ADD]='8B'
    [1SUB]='8C'
    [2MUL]='8D'
    [2DIV]='8E'
    [NEGATE]='8F'
    [ABS]='90'
    [NOT]='91'
    [0NOTEQUAL]='92'
    [ADD]='93'
    [SUB]='94'
    [MUL]='95'
    [DIV]='96'
    [MOD]='97'
    [LSHIFT]='98'
    [RSHIFT]='99'
    [BOOLAND]='9A'
    [BOOLOR]='9B'
    [NUMEQUAL]='9C'
    [NUMEQUALVERIFY]='9D'
    [NUMNOTEQUAL]='9E'
    [LESSTHAN]='9F'
    [GREATERTHAN]='A0'
    [LESSTHANOREQUAL]='A1'
    [GREATERTHANOREQUAL]='A2'
    [MIN]='A3'
    [MAX]='A4'
    [WITHIN]='A5'
    [RIPEMD160]='A6'
    [SHA1]='A7'
    [SHA256]='A8'
    [HASH160]='A9'
    [HASH256]='AA'
    [CODESEPARATOR]='AB'
    [CHECKSIG]='AC'
    [CHECKSIGVERIFY]='AD'
    [CHECKMULTISIG]='AE'
    [CHECKMULTISIGVERIFY]='AF'
    [NOP1]='B0'
    [NOP2]='B1'
    [CHECKLOCKTIMEVERIFY]='B1'
    [CLTV]='B1'
    [NOP3]='B2'
    [CHECKSEQUENCEVERIFY]='B2'
    [CSV]='B2'
    [NOP4]='B3'
    [NOP5]='B4'
    [NOP6]='B5'
    [NOP7]='B6'
    [NOP8]='B7'
    [NOP9]='B8'
    [NOP10]='B9'
    [SMALLINTEGER]='FA'
    [PUBKEYS]='FB'
    [PUBKEYHASH]='FD'
    [PUBKEY]='FE'
    [INVALIDOPCODE]='FF'
    [CHECKSIGFROMSTACKVERIFY]='BA'
    [CSTF]='BA'
    [PUSHTXDATA]='BB'
    [TXDATA]='BB'
    [EXPAND1]='D0'
    [EXPAND32]='EF')

declare -A op_num
op_num=( 
    [-1]='4F'
    [-0]='00'
    [0]='00'
    [1]='51'
    [2]='52'
    [3]='53'
    [4]='54'
    [5]='55'
    [6]='56'
    [7]='57'
    [8]='58'
    [9]='59'
    [10]='5A'
    [11]='5B'
    [12]='5C'
    [13]='5D'
    [14]='5E'
    [15]='5F'
    [16]='60')
