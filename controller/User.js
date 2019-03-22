import Base from './Base'
import userModel from '../model/User'
import logModel from '../model/Log'
import Authority from './Authority'
import JWT from 'jsonwebtoken'
import crypto from 'crypto'

class User extends Base {
  constructor () {
    super()
    this.registered = this.registered.bind(this)
    this.login = this.login.bind(this)
    this.loginOut = this.loginOut.bind(this)
    this.update = this.update.bind(this)
    this.delete = this.delete.bind(this)
    this.userInfo = this.userInfo.bind(this)
    this.getRow = this.getRow.bind(this)
    this.getList = this.getList.bind(this)
    this.getAll = this.getAll.bind(this)
  }
  // 注册
  async registered (req, res, next) {
    let search, result
    // 查询用户是否存在
    try {
      search = await userModel.getRow({get: {account: req.body.account}})
    } catch (e) {
      this.handleException(req, res, e)
      return
    }
    // 用户不存在创建用户，存在则提示
    if (search.length === 0) {
      try {
        let data = JSON.parse(JSON.stringify(req.body)),
            userInfo = this.getUserInfo(req)
        // TODO: 添加时有创建人, 注册时没有
        // 参数处理
        data.create_user = userInfo.id,
        data.create_time = new Date()
        result = await userModel.registered({
          set: data
        })
      } catch (e) {
        this.handleException(req, res, e)
        return
      }
      res.json({
        code: 20000,
        success: true,
        message: '注册成功'
      })
    } else {
      res.json({
        code: 20001,
        success: false,
        message: '用户已存在'
      })
    }
  }
  // 登录
  async login (req, res, next) {
    let account = req.body.account,
          password = req.body.password,
          type = req.body.type,
          search, token = [], data
    // 查询用户名密码是否正确, 以及为用户设置登录成功后的token
    try {
      search = await userModel.login({get: {account, password}})
      data = search[0] ? JSON.parse(JSON.stringify(search[0])) : {}
      if (data) {
        for (let key in data) {
          if (!data[key]) {
            delete data[key]
          }
        }
        // TODO: 得到要设置的token类型和过期时间, 功能以后再做
        switch (type) {
          case 0:
            data.type = 'phone'
            data[data.type + 'expire_time'] = +new Date() + 60 * 60 * 24 * 180 * 1000 // 半年
            break
          case 1:
            data.type = 'bbs'
            data[data.type + 'expire_time'] = +new Date() + 60 * 60 * 24 * 60 * 1000 // 两个月
            break
          case 2:
            data.type = 'admin'
            data[data.type + 'expire_time'] = +new Date() + 60 * 60 * 24 * 1 * 1000 // 重新登录则上次的失效
            break
        }
        try {
          // TODO: Token过期了重新设置，没过期就获取
          await Authority.setToken(data, {
            set: {[data.type + '_token']: JWT.sign(data, 'BBS', {}), user_id: data.id}
          })
        } catch (e) {
          this.handleException(req, res, e)
          return
        }
      }
    } catch (e) {
      this.handleException(req, res, e)
      return
    }
    // 查询为空即用户信息不正确，不为空说明查询成功
    if (search.length === 0) {
      res.json({
        code: 20301,
        success: false,
        message: '账号或密码错误'
      })
    } else {
      try {
        // 写入登录日志
        await logModel.writeLog({
          set: {
            origin: type,
            type: 1,
            title: '用户登录',
            desc: '',
            ip: this.getClientIp(req),
            create_user: search[0].id,
            create_time: new Date()
          }
        })
      } catch (e) {
        this.handleException(req, res, e)
        return
      }
      try {
        token = await Authority.getToken({get: {user_id: data.id}})
      } catch (e) {
        this.handleException(req, res, e)
        return
      }
      res.json({
        code: 20000,
        success: true,
        content: {},
        token: token[0] ? token[0][data.type + '_token'] : '',
        message: '登录成功'
      })
    }
  }
  // 退出登录
  async loginOut (req, res, next) {
    let userInfo = this.getUserInfo(req)
    // 设置Token过期时间为现在
    userInfo[userInfo.type + 'expire_time'] = +new Date()
    try {
      await Authority.setToken(userInfo, {
        set: {[userInfo.type + '_token']: JWT.sign(userInfo, 'BBS', {}), user_id: userInfo.id}
      })
    } catch (e) {
      this.handleException(req, res, e)
      return
    }
    try {
      let type = userInfo.type === 'phone' ? 0 : userInfo.type === 'bbs' ? 1 : 2
      // 写入登出日志
      await logModel.writeLog({
        set: {
          origin: type,
          type: 2,
          title: '用户登出',
          desc: '',
          ip: this.getClientIp(req),
          create_user: userInfo.id,
          create_time: new Date()
        }
      })
    } catch (e) {
      this.handleException(req, res, e)
      return
    }
    res.json({
      code: 20000,
      success: true,
      content: {},
      message: '操作成功'
    })
  }
  // 编辑用户
  async update (req, res, next) {
    let id = req.body.id,
        data = JSON.parse(JSON.stringify(req.body)),
        result,
        userInfo = this.getUserInfo(req)
        // 参数处理
        data.update_user = userInfo.id
        data.update_time = new Date()
        delete data.id
    try {
      result = await userModel.update({set: data, get: {id}})
    } catch (e) {
      this.handleException(req, res, e)
      return
    }
    if (result.affectedRows) {
      res.json({
        code: 20000,
        success: true,
        message: '编辑成功'
      })
    } else {
      res.json({
        code: 20001,
        success: false,
        message: '编辑失败'
      })
    }
  }
  // 删除用户
  async delete (req, res, next) {
    let id = req.params.id
    const result = await userModel.delete({get: {id}})
    if (result.affectedRows) {
      res.json({
        code: 20000,
        success: true,
        message: '删除成功'
      })
    } else {
      res.json({
        code: 20001,
        success: true,
        message: '删除失败'
      })
    }
  }
  // 获取用户信息
  async userInfo (req, res, next) {
    const userInfo = this.getUserInfo(req),
          search = await userModel.getRow({get: {id: userInfo.id}})
    if (search.length === 0) {
      res.json({
        code: 20401,
        success: false,
        content: search,
        message: '用户不存在'
      })
    } else {
      res.json({
        code: 20000,
        success: true,
        content: search,
        message: '操作成功'
      })
    }
  }
  // 获取单条数据
  async getRow (req, res, next) {
    const search = await userModel.getRow({get: req.query})
    if (search.length === 0) {
      res.json({
        code: 20401,
        success: false,
        content: search,
        message: '用户不存在'
      })
    } else {
      res.json({
        code: 20000,
        success: true,
        content: search,
        message: '操作成功'
      })
    }
  }
  // 查询用户列表
  async getList (req, res, next) {
    let curPage = req.query.curPage,
        pageSize = req.query.pageSize,
        params = JSON.parse(JSON.stringify(req.query)),
        result,
        length,
        userInfo = this.getUserInfo(req)
        delete params.curPage
        delete params.pageSize
        // 设置非模糊查询字段
        for (let key in params) {
          if (key !== 'id' && key !== 'create_user') {
            params.like = [...params.like || [], key]
          }
        }
    try {
      result = await userModel.getList(curPage, pageSize, {get: params})
      length = await userModel.getTotals({get: params})
    } catch (e) {
      this.handleException(req, res, e)
      return
    }
    res.json({
      code: 20000,
      success: true,
      content: {
        result,
        curPage,
        pageSize,
        totals: length ? length[0].count : 0
      },
      message: '操作成功'
    })
  }
  // 获取所有用户
  async getAll (req, res, next) {
    let result
    try {
      await userModel.getAll()
    } catch (e) {
      this.handleException(req, res, e)
      return
    }
    res.json({
      code: 20000,
      success: true,
      content: result,
      message: '操作成功'
    })
  }
}

export default new User()
