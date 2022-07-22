	boost_url="https://sourceforge.net/projects/boost/files/boost/1.61.0/"
	boost_pwd="${PWD}"
	boost_dir="${boost_pwd}/boost_1_61_0"
	boost_tgz="${boost_dir}.tar.gz"
	
	boost_ins="${boost_pwd}/boost"
	mkdir -p $boost_ins
	if [[ ! -f "$boost_tgz" ]]; then
		wget ${boost_url}${boost_tgz} -q --show-progress
	else
		echo "$boost_tgz already downloaded"
	fi
	echo "a77c7cc660ec02704c6884fbb20c552d52d60a18f26573c9cee0788bf00ed7e6 $boost_tgz" | sha256sum --check
	if [[ "$?" != 0 ]]; then
		echo "tar.gz checksum mismatches, deleting and redownloading"
		rm "$boost_tgz"
		wget ${boost_url}${boost_tgz} -q --show-progress
	fi
	if [[ -n $(command -v pv) ]]; then
		pv "$boost_tgz" | tar -xzf - -C "${boost_dir}/"
	else
		tar -zxvf "$boost_tgz -C ${boost_dir}/"
	fi

	cd "$boost_dir"
	echo 'using gcc : : g++ : <cxxflags>"-fvisibility=hidden -fPIC" <linkflags>"" <archiver>"ar" <striper>"strip"  <ranlib>"ranlib" <rc>"" : ;' > user-config.jam
	boost_opt="runtime-link=shared threadapi=pthread threading=multi link=static variant=release --layout=tagged --build-type=complete --user-config=user-config.jam -sNO_BZIP2=1"
	./bootstrap.sh --without-icu --with-libraries=chrono,filesystem,program_options,system,thread,test
	./b2 -d2 -j2 -d1 ${boost_opt} --prefix=${boost_ins} stage
	./b2 -d0 -j4 ${boost_opt} --prefix=${boost_ins} install
	unset boost_url boost_dir boost_tgz boost_pwd  
