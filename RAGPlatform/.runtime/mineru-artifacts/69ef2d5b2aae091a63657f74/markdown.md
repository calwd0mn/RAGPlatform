# 中 华 人 民 共 和 国 国 家 标 准

GB/T29871—2013

# 能源计量仪表通用数据接口技术协议

# Generaldatainterfacetechnologyprotocolofenergymeteringinstrument

2013-11-12发布

2014-04-15实施

## 目 次

前言  
1 范围  
规范性引用文件  
3 术语和定义  
通讯协议  
传输模式  
4.2 消息帧格式  
能源计量仪表类型及寄存器 2  
能源计量仪表类型 2  
能源计量仪表寄存器 3  
附录 A (规范性附录) 计量单位代码表 7  
附录 B(规范性附录) 功能码 8  
附录 (规范性附录) 循环冗余校验( )算法 9  
附录 (资料性附录) 通讯示例 …… (

## 前 言

本标准按照 / — 给出的规则起草。

本标准由全国计量器具管理标准化技术委员会( / )提出并归口。

本标准起草单位:福建省计量科学研究院、国家城市能源计量中心(福建)、福建海峡计量科技开发中心、福建省能源计量重点实验室、福州上润精密仪器有限公司、福建东辉智能仪表有限公司、福州海华星测控技术有限公司、内蒙古自治区计量测试研究院、江苏省计量科学研究院。

本标准主要起草人:方辉、魏鹏、方仁桂、高廷金、林军、朱炜琳、肖振光、梁宏霞、马宇明。

![](images/1fe15f16a60909bd36d928543194b1f3450d50294d71e253fd744c1817bb2ed7.jpg)

## 能源计量仪表通用数据接口技术协议

## 1 范围

本标准规定了能源计量仪表的通讯协议、类型及寄存器的要求。

本标准适用于基于 通信协议的能源计量仪表。

## 2 规范性引用文件

下列文件对于本文件的应用是必不可少的。凡是注日期的引用文件,仅注日期的版本适用于本文件。凡是不注日期的引用文件,其最新版本(包括所有的修改单)适用于本文件。

用能单位能源计量器具配备和管理通则

/ — 基于 协议的工业自动化网络规范 第 部分: 协议在串行链路上的实现指南

/ — 能源计量数据公共平台数据传输协议

## 3 术语和定义

、 / — 和 / — 界定的术语和定义适用于本文件。

## 4 通讯协议

## 41 传输模式

传输模式采用 模式,符合 / — 中 的规定。

## 42 消息帧格式

消息帧格式应符合图 的规定。

![](images/50eae3585f29b3c57a3dcdb8697e24734f06351742395623375b316d3f5ec175.jpg)  
图1 消息帧格式

## 421 起始符

标识一个消息帧的开始,一个消息帧至少要以发送 个字符时间的停顿间隔开始。

## 422 地址域

地址域用 表示能源计量仪表的数据交换地址,最多支持 个设备,可能的能源计量仪表地

址是 — (十进制), — 为保留。地址 是用作广播地址,如用于广播校时等。能源计量仪表计量单位代码见附录 。

## 423 功能域

功能域的规定如下:

) 功能域的长度为 ,格式如图 所示,其中 为应答标志;

) 当消息从数据集中采集终端发往能源计量仪表时,功能码将告之能源计量仪表需要执行哪些行为,应答标志 ;

) 当能源计量仪表回应时,它使用应答标志 来指示是正常回应还是有某种错误发生。对正常回应,能源计量仪表回应相应的功能码。对异常回应相应的功能码但 。详细功能码见附录 。

<table><tr><td rowspan=1 colspan=1>D7</td><td rowspan=1 colspan=1>D6</td><td rowspan=1 colspan=1>D5</td><td rowspan=1 colspan=1>D4</td><td rowspan=1 colspan=1>D3</td><td rowspan=1 colspan=1>D2</td><td rowspan=1 colspan=1>D1</td><td rowspan=1 colspan=1>D0</td></tr></table>

说明:

正常应答

异常应答

图2 功能域格式

## 424 数据域

数据域指定了起始地址和要读写的寄存器数量等信息。

## 425 校验域

校验域长度为 ,采用循环冗余校验( )校验码,见附录 。校验域附加在消息的最后,低字节在前 高字节在后

## 426 结束符

标识一帧信息的结束,一个消息帧至少要发送 个字符时间的停顿间隔表示帧结束。

## 427 通讯示例

通讯示例参照附录 。

## 5 能源计量仪表类型及寄存器

## 51 能源计量仪表类型

常用的能源计量仪表类型和仪表代码见表 。

表1 计量仪表类型和代码
<table><tr><td colspan="1" rowspan="1">能源计量仪表类型</td><td colspan="1" rowspan="1">代码</td></tr><tr><td colspan="1" rowspan="1">流量表</td><td colspan="1" rowspan="1">0x0001</td></tr><tr><td colspan="1" rowspan="1">热能表</td><td colspan="1" rowspan="1">0x0002</td></tr><tr><td colspan="1" rowspan="1">电能表</td><td colspan="1" rowspan="1">0x0003</td></tr><tr><td colspan="1" rowspan="1">称重仪表</td><td colspan="1" rowspan="1">0x0004</td></tr><tr><td colspan="1" rowspan="1">压力表</td><td colspan="1" rowspan="1">0x0005</td></tr><tr><td colspan="1" rowspan="1">温度表</td><td colspan="1" rowspan="1">0x0006</td></tr><tr><td colspan="1" rowspan="1">其他</td><td colspan="1" rowspan="1">0x0007—0xFFFF</td></tr></table>

## 52 能源计量仪表寄存器

能源计量仪表寄存器地址从 开始,寄存器地址 ,存储仪表类型;寄存器地址— ,存储日期时间, 字节 数分别表示秒分时日月年,低位在前;寄存器地址 ,存储能源计量仪表通道数;寄存器地址 ,存储每个通道数据占用寄存器数量。若是多通道能源计量仪表,根据地址 和 的内容决定每个通道所存数据的寄存器地址,每个通道的首地址的偏移量按每个通道数量占用的寄存器数量递增 例如在表 中 第 通道的起始数据寄存器地址为,第 通道的起始数据寄存器地址为 ,依此类推)。具体详见表 表 。

表 2 流量表寄存器说明
<table><tr><td colspan="1" rowspan="1">寄存器</td><td colspan="1" rowspan="1">变量名称</td><td colspan="1" rowspan="1">数据类型</td><td colspan="1" rowspan="1">说明</td></tr><tr><td colspan="1" rowspan="1">0x1000</td><td colspan="1" rowspan="1">能源计量仪表类型</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">详见表1</td></tr><tr><td colspan="1" rowspan="1">0x1001—0xl003</td><td colspan="1" rowspan="1">SAC日期时间</td><td colspan="1" rowspan="1">BCD</td><td colspan="1" rowspan="1">6字节BCD数分别表示秒分时日月年，低位在前</td></tr><tr><td colspan="1" rowspan="1">0x1004</td><td colspan="1" rowspan="1">能源计量仪表通道数</td><td colspan="1" rowspan="1">INT</td><td colspan="1" rowspan="1">2 字节整型数，采用小端模式</td></tr><tr><td colspan="1" rowspan="1">0x1005</td><td colspan="1" rowspan="1">每个通道数据占用寄存器数量</td><td colspan="1" rowspan="1">INT</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1006—1007</td><td colspan="1" rowspan="1">瞬时流量</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1">REAL4是标准IEEE-754格式单精度浮点数，一般也称为FLOAT格式，采用小端模式</td></tr><tr><td colspan="1" rowspan="1">0x1008</td><td colspan="1" rowspan="1">瞬时流量单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">见附录A</td></tr><tr><td colspan="1" rowspan="1">0x1009—100A</td><td colspan="1" rowspan="1">瞬时热流量</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0xl00B</td><td colspan="1" rowspan="1">瞬时热流量单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">见附录A</td></tr><tr><td colspan="1" rowspan="1">0x100C—100D</td><td colspan="1" rowspan="1">流体速度</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x100E</td><td colspan="1" rowspan="1">流体速度单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">见附录A</td></tr><tr><td colspan="1" rowspan="1">0xl00F—1012</td><td colspan="1" rowspan="1">正累积流量</td><td colspan="1" rowspan="1">DOUBLE</td><td colspan="1" rowspan="1">DOUBLE是标准IEEE-754格式双精确度浮点数</td></tr><tr><td colspan="1" rowspan="1">0x1013—1016</td><td colspan="1" rowspan="1">负累积流量</td><td colspan="1" rowspan="1">DOUBLE</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1017</td><td colspan="1" rowspan="1">累积流量单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">见附录A</td></tr><tr><td colspan="1" rowspan="1">0x1018—101B</td><td colspan="1" rowspan="1">正累积热量</td><td colspan="1" rowspan="1">DOUBLE</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x101C—101F</td><td colspan="1" rowspan="1">负累积热量</td><td colspan="1" rowspan="1">DOUBLE</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1020</td><td colspan="1" rowspan="1">累积热量单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">见附录A</td></tr><tr><td colspan="1" rowspan="1">0x1021—1022</td><td colspan="1" rowspan="1">温度1/进水温度</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1023—1024</td><td colspan="1" rowspan="1">温度2/回水温度</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1025</td><td colspan="1" rowspan="1">温度单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">见附录A</td></tr><tr><td colspan="1" rowspan="1">0x1026—1027</td><td colspan="1" rowspan="1">压力过程值</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1028</td><td colspan="1" rowspan="1">压力单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">其他</td><td colspan="1" rowspan="1">通道扩展</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td></tr></table>

表3 热能表寄存器说明
<table><tr><td rowspan=1 colspan=1>寄存器</td><td rowspan=1 colspan=1>变量名称</td><td rowspan=1 colspan=1>数据类型</td><td rowspan=1 colspan=1>说明</td></tr><tr><td rowspan=1 colspan=1>0x1000</td><td rowspan=1 colspan=1>能源计量仪表类型</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>详见表1</td></tr><tr><td rowspan=1 colspan=1>0x1001—0x1003</td><td rowspan=1 colspan=1>日期时间</td><td rowspan=1 colspan=1>BCD</td><td rowspan=1 colspan=1>6字节BCD 数分别表示秒分时日月年，低位在前</td></tr><tr><td rowspan=1 colspan=1>0x1004</td><td rowspan=1 colspan=1>能源计量仪表通道数</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1>2字节整型数，采用小端模式</td></tr><tr><td rowspan=1 colspan=1>0x1005</td><td rowspan=1 colspan=1>每个通道数据占用寄存器数量</td><td rowspan=1 colspan=1>SACINT</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1006—1007</td><td rowspan=1 colspan=1>瞬时流量</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1008</td><td rowspan=1 colspan=1>瞬时流量单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>见附录A</td></tr><tr><td rowspan=1 colspan=1>0x1009—100A</td><td rowspan=1 colspan=1>瞬时热流量</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0xl00B</td><td rowspan=1 colspan=1>瞬时热流量单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>见附录A</td></tr><tr><td rowspan=1 colspan=1>0x100C—100D</td><td rowspan=1 colspan=1>累积流量</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x100E</td><td rowspan=1 colspan=1>累积流量单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>见附录A</td></tr><tr><td rowspan=1 colspan=1>0x100F—1010</td><td rowspan=1 colspan=1>累积热量</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1011</td><td rowspan=1 colspan=1>累积热量单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>见附录A</td></tr><tr><td rowspan=1 colspan=1>0x1012—1013</td><td rowspan=1 colspan=1>进水温度</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1014—1015</td><td rowspan=1 colspan=1>回水温度</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1016</td><td rowspan=1 colspan=1>温度单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>其他</td><td rowspan=1 colspan=1>通道扩展</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1></td></tr></table>

表4 电能表寄存器说明
<table><tr><td colspan="1" rowspan="1">寄存器</td><td colspan="1" rowspan="1">变量名称</td><td colspan="1" rowspan="1">数据类型</td><td colspan="1" rowspan="1">说明</td></tr><tr><td colspan="1" rowspan="1">0xl000</td><td colspan="1" rowspan="1">能源计量仪表类型</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">详见表1</td></tr><tr><td colspan="1" rowspan="1">0x1001—0x1003</td><td colspan="1" rowspan="1">日期时间</td><td colspan="1" rowspan="1">BCD</td><td colspan="1" rowspan="1">6字节BCD数分别表示秒分时日月年，低位在前</td></tr><tr><td colspan="1" rowspan="1">0x1004</td><td colspan="1" rowspan="1">能源计量仪表通道数</td><td colspan="1" rowspan="1">INT</td><td colspan="1" rowspan="1">2 字节整型数，采用小端模式</td></tr><tr><td colspan="1" rowspan="1">0x1005</td><td colspan="1" rowspan="1">每个通道数据占用寄存器数量</td><td colspan="1" rowspan="1">INT</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1006—1007</td><td colspan="1" rowspan="1">当前总电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1008—1009</td><td colspan="1" rowspan="1">当前有功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0xl00A—100B</td><td colspan="1" rowspan="1">当前无功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x100C—100D</td><td colspan="1" rowspan="1">A相有功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0xl00E—100F</td><td colspan="1" rowspan="1">A相无功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1010—1011</td><td colspan="1" rowspan="1">B相有功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1012—1013</td><td colspan="1" rowspan="1">B相无功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1014—1015</td><td colspan="1" rowspan="1">C相有功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1016—1017</td><td colspan="1" rowspan="1">C相无功电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x1018—1019</td><td colspan="1" rowspan="1">功率因数</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0xl01A—101B</td><td colspan="1" rowspan="1">前一天电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x101C—101D</td><td colspan="1" rowspan="1">前一月电能</td><td colspan="1" rowspan="1">REAL4</td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0x101E</td><td colspan="1" rowspan="1">电能单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td></tr><tr><td colspan="1" rowspan="1">0xl01F</td><td colspan="1" rowspan="1">无功电能单位</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1">见附录A</td></tr><tr><td colspan="1" rowspan="1">其他</td><td colspan="1" rowspan="1">通道扩展</td><td colspan="1" rowspan="1"></td><td colspan="1" rowspan="1"></td></tr></table>

表5 称重仪表寄存器说明
<table><tr><td rowspan=1 colspan=1>寄存器</td><td rowspan=1 colspan=1>变量名称</td><td rowspan=1 colspan=1>数据类型</td><td rowspan=1 colspan=1>说明</td></tr><tr><td rowspan=1 colspan=1>0x1000</td><td rowspan=1 colspan=1>能源计量仪表类型</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>详见表1</td></tr><tr><td rowspan=1 colspan=1>0x1001—0xl003</td><td rowspan=1 colspan=1>日期时间</td><td rowspan=1 colspan=1>BCD</td><td rowspan=1 colspan=1>6字节BCD数分别表示秒分时日月年，低位在前</td></tr><tr><td rowspan=1 colspan=1>0xl004</td><td rowspan=1 colspan=1>能源计量仪表通道数</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1>2 字节整型数，采用小端模式</td></tr><tr><td rowspan=1 colspan=1>0x1005</td><td rowspan=1 colspan=1>每个通道数据占用寄存器数量</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1006—1007</td><td rowspan=1 colspan=1>当前测量值</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1008</td><td rowspan=1 colspan=1>单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1009—100A</td><td rowspan=1 colspan=1>累积值</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x100B—100C</td><td rowspan=1 colspan=1>累积次数</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x100D</td><td rowspan=1 colspan=1>累积单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>见附录A</td></tr><tr><td rowspan=1 colspan=1>其他</td><td rowspan=1 colspan=1>通道扩展</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1></td></tr></table>

表6 压力表寄存器说明
<table><tr><td rowspan=1 colspan=1>寄存器</td><td rowspan=1 colspan=1>变量名称</td><td rowspan=1 colspan=1>数据类型</td><td rowspan=1 colspan=1>说明</td></tr><tr><td rowspan=1 colspan=1>0x1000</td><td rowspan=1 colspan=1>能源计量仪表类型</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>详见表1</td></tr><tr><td rowspan=1 colspan=1>0x1001—0x1003</td><td rowspan=1 colspan=1>日期时间</td><td rowspan=1 colspan=1>BCD</td><td rowspan=1 colspan=1>6字节BCD数分别表示秒分时日月年，低位在前</td></tr><tr><td rowspan=1 colspan=1>0x1004</td><td rowspan=1 colspan=1>能源计量仪表通道数</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1>2 字节整型数，采用小端模式</td></tr><tr><td rowspan=1 colspan=1>0x1005</td><td rowspan=1 colspan=1>每个通道数据占用寄存器数量</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1006—1007</td><td rowspan=1 colspan=1>压力</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1008</td><td rowspan=1 colspan=1>压力单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>见附录A</td></tr><tr><td rowspan=1 colspan=1>其他</td><td rowspan=1 colspan=1>通道扩展</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1></td></tr></table>

表7 温度表寄存器说明
<table><tr><td rowspan=1 colspan=1>寄存器</td><td rowspan=1 colspan=1>变量名称</td><td rowspan=1 colspan=1>数据类型</td><td rowspan=1 colspan=1>说明</td></tr><tr><td rowspan=1 colspan=1>0x1000</td><td rowspan=1 colspan=1>能源计量仪表类型</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>详见表1</td></tr><tr><td rowspan=1 colspan=1>0x1001—0x1003</td><td rowspan=1 colspan=1>日期时间</td><td rowspan=1 colspan=1>BCD</td><td rowspan=1 colspan=1>6字节BCD数分别表示秒分时日月年，低位在前</td></tr><tr><td rowspan=1 colspan=1>0x1004</td><td rowspan=1 colspan=1>能源计量仪表通道数</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1>2 字节整型数，采用小端模式</td></tr><tr><td rowspan=1 colspan=1>0x1005</td><td rowspan=1 colspan=1>每个通道数据占用寄存器数量</td><td rowspan=1 colspan=1>INT</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1006—1007</td><td rowspan=1 colspan=1>温度</td><td rowspan=1 colspan=1>REAL4</td><td rowspan=1 colspan=1></td></tr><tr><td rowspan=1 colspan=1>0x1008</td><td rowspan=1 colspan=1>温度单位</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>见附录A</td></tr><tr><td rowspan=1 colspan=1>其他</td><td rowspan=1 colspan=1>通道扩展</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1></td></tr></table>

## 附 录 A

(规范性附录)

计量单位代码表

表 规定了常用的计量单位代码。

表 A1 计量单位代码表
<table><tr><td rowspan=1 colspan=1>名称</td><td rowspan=1 colspan=1>单位</td><td rowspan=1 colspan=1>代号</td></tr><tr><td rowspan=1 colspan=1>电能</td><td rowspan=1 colspan=1>kWh</td><td rowspan=1 colspan=1>0x0001</td></tr><tr><td rowspan=1 colspan=1>电能</td><td rowspan=1 colspan=1>MWh</td><td rowspan=1 colspan=1>0x0002</td></tr><tr><td rowspan=1 colspan=1>无功电能</td><td rowspan=1 colspan=1>kvarh</td><td rowspan=1 colspan=1>0x0003</td></tr><tr><td rowspan=1 colspan=1>无功电能</td><td rowspan=1 colspan=1>Mvarh</td><td rowspan=1 colspan=1>0x0004</td></tr><tr><td rowspan=1 colspan=1>热能</td><td rowspan=1 colspan=1>kJ</td><td rowspan=1 colspan=1>0x0005</td></tr><tr><td rowspan=1 colspan=1>热能</td><td rowspan=1 colspan=1>MJ</td><td rowspan=1 colspan=1>0x0006</td></tr><tr><td rowspan=1 colspan=1>热能</td><td rowspan=1 colspan=1>GJ</td><td rowspan=1 colspan=1>0x0007</td></tr><tr><td rowspan=1 colspan=1>热流量</td><td rowspan=1 colspan=1>kJ/h</td><td rowspan=1 colspan=1>0x0008</td></tr><tr><td rowspan=1 colspan=1>热流量</td><td rowspan=1 colspan=1>kJ/min</td><td rowspan=1 colspan=1>0x0009</td></tr><tr><td rowspan=1 colspan=1>热流量</td><td rowspan=1 colspan=1>GJ/h</td><td rowspan=1 colspan=1>0x000A</td></tr><tr><td rowspan=1 colspan=1>热流量</td><td rowspan=1 colspan=1>GJ/d</td><td rowspan=1 colspan=1>0x000B</td></tr><tr><td rowspan=1 colspan=1>体积流量</td><td rowspan=1 colspan=1>m^³/min</td><td rowspan=1 colspan=1>0x000C</td></tr><tr><td rowspan=1 colspan=1>体积流量</td><td rowspan=1 colspan=1>$m^{/h</td><td rowspan=1 colspan=1>0x000D</td></tr><tr><td rowspan=1 colspan=1>体积流量</td><td rowspan=1 colspan=1>L/min</td><td rowspan=1 colspan=1>0x000E</td></tr><tr><td rowspan=1 colspan=1>体积流量</td><td rowspan=1 colspan=1>L/h</td><td rowspan=1 colspan=1>0x000F</td></tr><tr><td rowspan=1 colspan=1>质量流量</td><td rowspan=1 colspan=1>t/h</td><td rowspan=1 colspan=1>0x0010</td></tr><tr><td rowspan=1 colspan=1>质量流量</td><td rowspan=1 colspan=1>kg/h</td><td rowspan=1 colspan=1>0x0011</td></tr><tr><td rowspan=1 colspan=1>质量流量</td><td rowspan=1 colspan=1>kg/min</td><td rowspan=1 colspan=1>0x0012</td></tr><tr><td rowspan=1 colspan=1>流速</td><td rowspan=1 colspan=1> $\mathrm { m } / \mathrm { s }$ </td><td rowspan=1 colspan=1>0x0013</td></tr><tr><td rowspan=1 colspan=1>体积</td><td rowspan=1 colspan=1>$m^{$</td><td rowspan=1 colspan=1>0x0014</td></tr><tr><td rowspan=1 colspan=1>重量</td><td rowspan=1 colspan=1></td><td rowspan=1 colspan=1>0x0015</td></tr><tr><td rowspan=1 colspan=1>温度</td><td rowspan=1 colspan=1>℃</td><td rowspan=1 colspan=1>0x0016</td></tr><tr><td rowspan=1 colspan=1>压力</td><td rowspan=1 colspan=1>kPa</td><td rowspan=1 colspan=1>0x0017</td></tr><tr><td rowspan=1 colspan=1>压力</td><td rowspan=1 colspan=1>MPa</td><td rowspan=1 colspan=1>0x0018</td></tr><tr><td rowspan=1 colspan=1>电流</td><td rowspan=1 colspan=1>mA</td><td rowspan=1 colspan=1>0x0019</td></tr><tr><td rowspan=1 colspan=1>电流</td><td rowspan=1 colspan=1>A</td><td rowspan=1 colspan=1>0x001A</td></tr><tr><td rowspan=1 colspan=1>电压</td><td rowspan=1 colspan=1>mV</td><td rowspan=1 colspan=1>0x001B</td></tr><tr><td rowspan=1 colspan=1>电压</td><td rowspan=1 colspan=1>V</td><td rowspan=1 colspan=1>0x001C</td></tr></table>

## 附 录 B

(规范性附录)

功 能 码

表 规定了协议的功能码。

表 B1 功能码
<table><tr><td rowspan=1 colspan=3>功能分类</td><td rowspan=1 colspan=1>功能名称</td><td rowspan=1 colspan=1>功能码</td></tr><tr><td rowspan=13 colspan=1>数据访问</td><td rowspan=4 colspan=1>比特访问</td><td rowspan=1 colspan=1>物理离散量输入</td><td rowspan=1 colspan=1>读离散量输入</td><td rowspan=1 colspan=1>0x02</td></tr><tr><td rowspan=3 colspan=1>內部比特或物理线圈</td><td rowspan=1 colspan=1>读线圈</td><td rowspan=1 colspan=1>0x01</td></tr><tr><td rowspan=1 colspan=1>写单个线圈</td><td rowspan=1 colspan=1>0x05</td></tr><tr><td rowspan=1 colspan=1>写多个线圈</td><td rowspan=1 colspan=1>0x0F</td></tr><tr><td rowspan=7 colspan=1>16比特访问</td><td rowspan=1 colspan=1>物理输入寄存器</td><td rowspan=1 colspan=1>读输入寄存器</td><td rowspan=1 colspan=1>0x04</td></tr><tr><td rowspan=6 colspan=1>内部寄存器或物理输出器寄存器</td><td rowspan=1 colspan=1>读保持寄存器</td><td rowspan=2 colspan=1>0x030x06</td></tr><tr><td rowspan=1 colspan=1>写单个寄存器</td></tr><tr><td rowspan=1 colspan=1>写多个寄存器</td><td rowspan=1 colspan=1>0x10</td></tr><tr><td rowspan=1 colspan=1>读/写多个寄存器</td><td rowspan=3 colspan=1>0x170x160x18</td></tr><tr><td rowspan=1 colspan=1>屏蔽写寄存器</td></tr><tr><td rowspan=1 colspan=1>读FIFO队列</td></tr><tr><td rowspan=2 colspan=2>文件记录访问</td><td rowspan=1 colspan=1>读文件记录</td><td rowspan=1 colspan=1>0x14</td></tr><tr><td rowspan=1 colspan=1>写文件记录</td><td rowspan=1 colspan=1>0x15</td></tr><tr><td rowspan=6 colspan=3>诊断</td><td rowspan=1 colspan=1>读异常状态</td><td rowspan=1 colspan=1>0x07</td></tr><tr><td rowspan=1 colspan=1>诊断</td><td rowspan=1 colspan=1>0x08</td></tr><tr><td rowspan=1 colspan=1>获得事件计数器</td><td rowspan=1 colspan=1>0x0B</td></tr><tr><td rowspan=1 colspan=1>获得事件记录</td><td rowspan=1 colspan=1>0x0C</td></tr><tr><td rowspan=1 colspan=1>报告从站 ID</td><td rowspan=1 colspan=1>0x11</td></tr><tr><td rowspan=1 colspan=1>读设备标识码</td><td rowspan=1 colspan=1>0x2B</td></tr></table>

# 附 录 C

# (规范性附录)循环冗余校验(CRC)算法

## C1 循环冗余校验(CRC)算法说明

## C11 CRC说明

( )是一种数据传输错误检查方法, 码两个字节,包含一 位的二进制值 它由传输设备计算后加入到数据包中 接收设备重新计算收到消息的 并与接收到的域中的值比较,如果两值不同,则有误。

## C12 CRC具体算法

是先调入一值是全 的 位寄存器 然后调用一过程将消息中连续的 位字节时当前寄存器中的值进行处理。仅每个字符中的 数据对 有效,起始位和停止位以及奇偶校验位均无效。

## C2 CRC校验字节的生成步骤

校验字节的生成步骤如下:

) 装一个 位寄存器,所有数位均为 ;

) 取被校验串的一个字节与 位寄存器的高位字节进行“异或”运算。运算结果放入这个 位寄存器;

) 把这个 位寄存器向右移一位;

) 若向右(标记位)移出的数位是 ,则生成多项式 和这个寄存器进行“异或”运算;若向右移出的数位是 ,则返回 );

) 重复 )和 ),直至移出 位;

) 取被校验串的下一个字节;

) 重复 ) ),直至被校验串的所有字节均与 位寄存器进行“异或”运算,并移位 次;

) 这个 位寄存器的内容即 字节 错误校验码。校验码按照先高字节后低字节的顺序存放。

附 录 D

(资料性附录)

通 讯 示 例

例如读取流量表的瞬时流量值,设地址为 的流量表瞬时流量值为 3/ 。

## D1 数据集中采集终端请求帧

数据集中采集终端请求帧示例见表 。

表 D1 数据集中采集终端请求帧
<table><tr><td rowspan=1 colspan=7>数据集中采集终端请求</td></tr><tr><td rowspan=1 colspan=1>地址</td><td rowspan=1 colspan=1>功能码</td><td rowspan=1 colspan=1>起始地址高位</td><td rowspan=1 colspan=1>起始地址低位</td><td rowspan=1 colspan=1>寄存器数量的高位</td><td rowspan=1 colspan=1>寄存器数量的低位</td><td rowspan=1 colspan=1>CRC</td></tr><tr><td rowspan=1 colspan=1>01</td><td rowspan=1 colspan=1>03</td><td rowspan=1 colspan=1>10</td><td rowspan=1 colspan=1>06</td><td rowspan=1 colspan=1>00</td><td rowspan=1 colspan=1>03</td><td rowspan=1 colspan=1>XXXX</td></tr></table>

## D2 能源计量仪表正常应答帧

能源计量仪表正常应答帧示例见表 。

表 D2 能源计量仪表正常应答帧
<table><tr><td rowspan=1 colspan=10>能源计量仪表正常应答</td></tr><tr><td rowspan=1 colspan=1>地址</td><td rowspan=1 colspan=1>功能码</td><td rowspan=1 colspan=1>字节数</td><td rowspan=1 colspan=1>数据1高位</td><td rowspan=1 colspan=1>数据1低位</td><td rowspan=1 colspan=1>数据2高位</td><td rowspan=1 colspan=1>数据2低位</td><td rowspan=1 colspan=1>数据3高位</td><td rowspan=1 colspan=1>数据3低位</td><td rowspan=1 colspan=1>CRC</td></tr><tr><td rowspan=1 colspan=1>01</td><td rowspan=1 colspan=1>03</td><td rowspan=1 colspan=1>06</td><td rowspan=1 colspan=1>41</td><td rowspan=1 colspan=1>24</td><td rowspan=1 colspan=1>00</td><td rowspan=1 colspan=1>01</td><td rowspan=1 colspan=1>00</td><td rowspan=1 colspan=1>OD</td><td rowspan=1 colspan=1>xxXX</td></tr><tr><td rowspan=1 colspan=10>十六进制数41240001表示的十进制10.25，数据3表示单位</td></tr></table>

## D3 能源计量仪表错误应答帧

能源计量仪表错误应答帧示例见表 。

表 D3 能源计量仪表错误应答帧
<table><tr><td rowspan=1 colspan=4>能源计量仪表错误应答</td></tr><tr><td rowspan=1 colspan=1>地址</td><td rowspan=1 colspan=1>功能码</td><td rowspan=1 colspan=1>异常码</td><td rowspan=1 colspan=1>CRC</td></tr><tr><td rowspan=1 colspan=1>01</td><td rowspan=1 colspan=1>83</td><td rowspan=1 colspan=1>XX</td><td rowspan=1 colspan=1>XXXX</td></tr></table>

![](images/fc1c7433fd828636a6223e1dc924c73ba63655af43f3673da69333e274f6fbc9.jpg)  
GB/T 29871-2013

中 华 人 民 共 和 国

国 家 标 准

能源计量仪表通用数据接口技术协议

GB/T 29871—2013

中 国 标 准 出 版 社 出 版 发 行北京市朝阳区和平里西街甲 号( )北京市西城区三里河北街 号( )

网址:www.b168.cn

服务热线:

010-68522006

年 月第一版

书号: ·

版权专有 侵权必究