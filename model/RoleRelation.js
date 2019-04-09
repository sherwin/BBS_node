import mysql from 'mysql'
import query from '../mysql'
import Base from './Base'

class RoleRelation extends Base{
  constructor () {
    super()
    this.setPermissions = this.setPermissions.bind(this)
    this.getBindUser = this.getBindUser.bind(this)
    this.getMenu = this.getMenu.bind(this)
    this.getDataPerms = this.getDataPerms.bind(this)
  }
  async setPermissions (obj) {
    let dbMenu, dbDataPerms, paramsMenu, paramsDataPerms,
        createMenuList = [], deleteMenuList = [], createDataPermsList = [], deleteDataPermsList = [],
        sql1, sql2, sql3, sql4, result1, result2, result3, result4
    // 先查询到所有的菜单以及数据权限
    dbMenu =  await query(`select a.menu_id from bbs_role_menu as a where 1 = 1 ${this.joinStr('get', obj.get)}`)
    dbDataPerms = await query(`select a.data_perms_id from bbs_role_data_perms as a where 1= 1 ${this.joinStr('get', obj.get)}`)
    paramsMenu = obj.data.menu || []
    paramsDataPerms = obj.data.permissions || []
    // 得到数据库的ID列表
    dbMenu = dbMenu.map(item => item.menu_id)
    dbDataPerms = dbDataPerms.map(item => item.data_perms_id)
    // 数据库数据和传入数据做对比，数据库有而传入没有的数据删除，传入而数据库没有的数据添加
    dbMenu.forEach(item => {
      // 需要删除菜单的数据
      if (!paramsMenu.includes(item)) {
        deleteMenuList.push(item)
      }
    })
    paramsMenu.forEach(item => {
      // 需要添加菜单的数据
      if (!dbMenu.includes(item)) {
        createMenuList.push([obj.get.role_id, item])
      }
    })
    dbDataPerms.forEach(item => {
      // 需要删除数据权限的数据
      if (!paramsDataPerms.includes(item)) {
        deleteDataPermsList.push(item)
      }
    })
    paramsDataPerms.forEach(item => {
      // 需要添加数据权限的数据
      if (!dbDataPerms.includes(item)) {
        createDataPermsList.push([obj.get.role_id, item])
      }
    })
    // 事务开始
    await query('begin')
    // 删除
    sql1 = `DELETE from bbs_role_menu where menu_id in (${mysql.escape(deleteMenuList)})`
    sql2 = `DELETE from bbs_role_data_perms where data_perms_id in (${mysql.escape(deleteDataPermsList)})`
    // 添加
    sql3 = `INSERT INTO bbs_role_menu (role_id, menu_id) VALUES ${mysql.escape(createMenuList)}`
    sql4 = `INSERT INTO bbs_role_data_perms (role_id, data_perms_id) VALUES ${mysql.escape(createDataPermsList)}`
    // 运行sql
    result1 = mysql.escape(deleteMenuList) ? await query(sql1) : {affectedRows: true}
    result2 = mysql.escape(deleteDataPermsList) ? await query(sql2) : {affectedRows: true}
    result3 = mysql.escape(createMenuList) ? await query(sql3) : {affectedRows: true}
    result4 = mysql.escape(createDataPermsList) ? await query(sql4) : {affectedRows: true}
    if (result1.affectedRows >= 0 && result2.affectedRows >= 0 && result3.affectedRows && result4.affectedRows) {
      // 事务提交
      await query('commit')
    } else {
      // 事务回滚
      await query('rollback')
    }
    return result1.affectedRows >= 0 && result2.affectedRows >= 0 && result3.affectedRows && result4.affectedRows
  }
  async setBindUser (obj) {
    let dbUser, paramsUser,
        createUserList = [], deleteUserList = [],
        sql1, sql2, result1, result2
    // 先查询到所有的用户
    dbUser =  await query(`select a.user_id from bbs_user_role as a where 1 = 1 ${this.joinStr('get', obj.get)}`)
    paramsUser = obj.data.user || []
    // 得到数据库的ID列表
    dbUser = dbMenu.map(item => item.user_id)
    // 数据库数据和传入数据做对比，数据库有而传入没有的数据删除，传入而数据库没有的数据添加
    dbUser.forEach(item => {
      // 需要删除用户的数据
      if (!paramsUser.includes(item)) {
        deleteMenuList.push(item)
      }
    })
    paramsUser.forEach(item => {
      // 需要添加用户的数据
      if (!dbUser.includes(item)) {
        createUserList.push([obj.get.role_id, item])
      }
    })
    // 事务开始
    await query('begin')
    // 删除
    sql1 = `DELETE from bbs_user_role where menu_id in (${mysql.escape(deleteUserList)})`
    // 添加
    sql2 = `INSERT INTO bbs_user_role (role_id, user_id) VALUES ${mysql.escape(createUserList)}`
    // 运行sql
    result1 = mysql.escape(deleteMenuList) ? await query(sql1) : {affectedRows: true}
    result2 = mysql.escape(createDataPermsList) ? await query(sql4) : {affectedRows: true}
    if (result1.affectedRows >= 0 && result2.affectedRows) {
      // 事务提交
      await query('commit')
    } else {
      // 事务回滚
      await query('rollback')
    }
    return result1.affectedRows >= 0 && result2.affectedRows
  }
  async getBindUser (obj) {
    const sql = `select a.id, a.account, a.name, a.role_id from bbs_user as a
                LEFT JOIN bbs_user_role as b
                ON a.id =  b.id where 1 = 1 ${this.joinStr('get', obj.get)}`
    return query(sql)
  }
  async getMenu (obj) {
    const sql = `select a.id from bbs_menu as a
                LEFT JOIN bbs_role_menu as b
                ON a.id = b.menu_id where 1 = 1 ${this.joinStr('get', obj.get)}`
    return query(sql)
  }
  async getDataPerms (obj) {
    const sql = `select a.id from bbs_data_perms as a
                LEFT JOIN bbs_role_data_perms as b
                ON a.id = b.data_perms_id where 1 = 1 ${this.joinStr('get', obj.get)}`
    return query(sql)
  }
}

export default new RoleRelation()
