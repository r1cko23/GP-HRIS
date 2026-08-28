-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[forreceivingcopy]
	-- Add the parameters for the stored procedure here
		@parayear nvarchar(5),
		@idclient int,
		@companyname nvarchar(100),
		@iddepartment int,
		@departmentdesc nvarchar(50),
		@paythrough nvarchar(10)


AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT        thirteenmonth.idthirteenmonth, thirteenmonth.employee_id, thirteenmonth.lname, thirteenmonth.fname, thirteenmonth.mname, thirteenmonth.TBasic, thirteenmonth.Amount, thirteenmonth.acctno, thirteenmonth.paythrough, 
                         thirteenmonth.idclient, thirteenmonth.iddepartment, thirteenmonth.idposition, thirteenmonth.thirteenmonthyear, thirteenmonth.status, client_branch_position.jobposition, client.companyname, Department.Department_desc, 
                         Employee.datehired, client.signprepared, client.signapproved, client.signnoted, Employee.bankaccountno, Employee.paythrough AS Expr1
FROM            thirteenmonth INNER JOIN
                         client_branch_position ON thirteenmonth.idposition = client_branch_position.idbranchposition INNER JOIN
                         client ON thirteenmonth.idclient = client.idclient INNER JOIN
                         Department ON thirteenmonth.iddepartment = Department.iddepartment INNER JOIN
                         Employee ON thirteenmonth.employee_id = Employee.Employee_id
WHERE        (thirteenmonth.idclient = @idclient) AND (thirteenmonth.iddepartment = @iddepartment) AND (thirteenmonth.paythrough Like +'%'+ @paythrough +'%') and (thirteenmonth.thirteenmonthyear = @parayear) 
ORDER BY thirteenmonth.lname
END
