

-- ==================================================
-- Author:		Nianz
-- Create date: 24.Nov.2022 08:04
-- Description:	Get records for Selected Excel Acrual
-- ==================================================
CREATE PROCEDURE [dbo].[usp_Accrual_GetExcelDataSelected]
	@idClient INT,
	@departmentCode INT
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	SELECT 
		e.employee_id, [fullname] = UPPER(TRIM(e.lname + ', ' + e.fname + ' ' + ISNULL(e.mname,''))), e.status, [jobposition] = aex.[Positiondesc], d.Department_desc, e.departmentsub, cbp.dailyratepayroll 
	FROM 
		Employee As e 
		INNER JOIN Accrualexport aex ON aex.Employee_Id = e.employee_id
		INNER JOIN client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
		INNER JOIN Department AS d ON e.department_code = d.iddepartment  
	WHERE 
		aex.idclient = @idClient
		AND aex.IDdepartment = @departmentCode
		--AND e.forpayroll = 'Y' 
	ORDER BY jobposition,fullname
END
