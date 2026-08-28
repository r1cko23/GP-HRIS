-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[loanshowempwithloan]
	-- Add the parameters for the stored procedure here
		@idclient int, 
		@filtername varchar(50),
		@iddepart int
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;


--SELECT distinct       Employee.Employee_id, Employee.lname +', ' + Employee.fname as fullname,idclientloan,lname,fname
--FROM            loan INNER JOIN
--                         Employee ON loan.employee_id = Employee.Employee_id
--						WHERE idclientloan = @idclient and iddepartmentloan = @iddepart AND lname LIKE '%' + @filtername + '%'
--						order by lname, fname

SELECT distinct       Employee.Employee_id
,CASE 
        WHEN Employee.mname <> '' THEN LEFT(Employee.mname, 1)
        ELSE ''
    END AS mname_flag,
    Employee.lname + ', ' + Employee.fname + ' ' + 
    CASE 
        WHEN Employee.mname <> '' THEN LEFT(Employee.mname, 1) + '.'
        ELSE ''
    END AS fullname



,employee.idclient
,Employee.department_code
,lname
,fname

FROM  loan INNER JOIN
Employee ON loan.employee_id = Employee.Employee_id
WHERE lname LIKE '%' + @filtername + '%'  or fname    LIKE '%' + @filtername + '%'
order by lname, fname



END
