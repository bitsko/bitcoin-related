#!/bin/bash

alias bc="${BC_PROG}"
export BC_LINE_LENGTH=0

export BC_ENV_ARGS=( \
    -q -l \
    ./config.bc \
    ./base/conversion.bc ./base/helpers.bc \
    ./logic/bitwise_logic.bc ./logic/shift_rot.bc \
    ./hash/hmac_conf.bc ./hash/hmac.bc ./hash/.tests/test_hmac.bc \
    ./math/math_mod.bc ./math/extended_euclidean.bc ./math/tonelli_shanks.bc ./math/root_mod.bc \
    ./ec_math/endomorphism.bc ./ec_math/ec_point.bc ./ec_math/ec_math.bc ./ec_math/jacobian.bc \
    ./ecdsa/ecdsa.bc \
    ./ec_math/curves/koblitz.bc ./activate.bc)
