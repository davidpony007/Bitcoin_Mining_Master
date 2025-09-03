package com.cloudminingtool.bitcoinminingmaster.ui.Contracts

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class ContractsViewModel : ViewModel() {   // 定义一个名为 ContractsViewModel 的类，继承自 ViewModel，用于为合约页面提供和管理数据。

    private val _text = MutableLiveData<String>().apply {  //声明一个私有的 MutableLiveData 类型变量 _text，初始值为 "This is Contracts Fragment"，用于存储和更新字符串数据。
//        value = "This is Contracts Fragment"
    // 设置初始值为 "This is Contracts Fragment"，表示合约页面的默认文本。
    }
    val text: LiveData<String> = _text  // 定义一个只读的 LiveData 类型变量 text，公开 _text 的数据，以便在 UI 中观察和获取合约页面的文本数据。
}